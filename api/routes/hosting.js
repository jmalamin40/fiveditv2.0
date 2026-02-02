const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

router.use(authenticate, requireAdmin);

// Helper function to get encryption key (must be 32 bytes)
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.substring(0, 32), 'utf8');
  }
  // Default key (should be changed in production!)
  return Buffer.from('default-encryption-key-32-chars!!', 'utf8');
}

// Helper function to decrypt password
function decryptPassword(encryptedPassword) {
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedPassword.substring(0, 32), 'hex');
  const encrypted = encryptedPassword.substring(32);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to encrypt password
function encryptPassword(password) {
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + encrypted;
}

// Get DirectAdmin configuration
async function getDirectAdminConfig() {
  const [configs] = await pool.execute(
    'SELECT * FROM hosting_config WHERE is_active = TRUE LIMIT 1'
  );
  return configs.length > 0 ? configs[0] : null;
}

// Make DirectAdmin API request
function makeDirectAdminRequest(config, command, params = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const password = decryptPassword(config.whm_password_encrypted);
    const auth = Buffer.from(`${config.whm_username}:${password}`).toString('base64');
    
    // Try SSL first if configured, fallback to HTTP if SSL fails
    const trySSL = config.whm_ssl !== false;
    const port = config.whm_port || 2222;
    const hostname = config.whm_host;
    
    const makeRequest = (useSSL) => {
      let url, options;
      
      if (method === 'GET') {
        const queryParams = new URLSearchParams({
          ...params,
        });
        url = `/${command}?${queryParams}`;
        
        options = {
          hostname: hostname,
          port: port,
          path: url,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          rejectUnauthorized: false,
        };
      } else {
        url = `/${command}`;
        const formData = new URLSearchParams(params);
        
        options = {
          hostname: hostname,
          port: port,
          path: url,
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData.toString()),
            'Accept': 'application/json',
          },
          rejectUnauthorized: false,
        };
      }
      
      // Use http or https module based on protocol
      const httpModule = useSSL ? https : http;
      const request = httpModule.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // DirectAdmin can return JSON or key=value format
            if (data.trim().startsWith('{')) {
              const json = JSON.parse(data);
              if (json.error) {
                reject(new Error(json.error || 'DirectAdmin API error'));
              } else {
                resolve(json);
              }
            } else {
              // Parse key=value format
              const result = {};
              const lines = data.split('\n');
              for (const line of lines) {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                  const key = match[1].trim();
                  let value = match[2].trim();
                  // Try to parse as number or boolean
                  if (value === 'yes') value = true;
                  else if (value === 'no') value = false;
                  else if (!isNaN(value) && value !== '') value = parseFloat(value);
                  result[key] = value;
                }
              }
              resolve(result);
            }
          } catch (error) {
            // If parsing fails, return raw data
            if (data.includes('error=')) {
              const errorMatch = data.match(/error=([^\n]+)/);
              reject(new Error(errorMatch ? errorMatch[1] : 'DirectAdmin API error'));
            } else {
              resolve(data);
            }
          }
        });
      });
      
      request.on('error', (error) => {
        // If SSL error and we tried SSL, retry with HTTP
        if (useSSL && (error.code === 'ECONNRESET' || error.message.includes('wrong version number') || error.message.includes('SSL'))) {
          console.log(`SSL connection failed, retrying with HTTP for ${hostname}:${port}`);
          makeRequest(false);
        } else {
          reject(new Error(`DirectAdmin request failed: ${error.message}`));
        }
      });
      
      if (method === 'POST') {
        const formData = new URLSearchParams(params);
        request.write(formData.toString());
      }
      
      request.end();
    };
    
    // Start with SSL if configured, otherwise use HTTP
    makeRequest(trySSL);
  });
}

// Get hosting configuration
router.get('/config', async (req, res) => {
  try {
    const [configs] = await pool.execute(
      'SELECT id, whm_host, whm_username, whm_port, whm_ssl, reseller_username, is_active, created_at, updated_at FROM hosting_config WHERE is_active = TRUE LIMIT 1'
    );
    
    if (configs.length === 0) {
      return res.json({ config: null });
    }
    
    res.json({ config: configs[0] });
  } catch (error) {
    console.error('Error fetching hosting config:', error);
    res.status(500).json({ error: 'Failed to fetch hosting configuration' });
  }
});

// Save/Update hosting configuration
router.post('/config', async (req, res) => {
  try {
    const { whm_host, whm_username, whm_password, whm_port, whm_ssl, reseller_username } = req.body;
    
    if (!whm_host || !whm_username || !whm_password) {
      return res.status(400).json({ error: 'DirectAdmin host, username, and password are required' });
    }
    
    const encryptedPassword = encryptPassword(whm_password);
    
    // Check if config exists
    const [existing] = await pool.execute(
      'SELECT id FROM hosting_config WHERE is_active = TRUE LIMIT 1'
    );
    
    if (existing.length > 0) {
      // Update existing
      await pool.execute(
        `UPDATE hosting_config SET 
          whm_host = ?, whm_username = ?, whm_password_encrypted = ?, 
          whm_port = ?, whm_ssl = ?, reseller_username = ?, updated_at = NOW()
         WHERE id = ?`,
        [whm_host, whm_username, encryptedPassword, whm_port || 2222, whm_ssl !== false, reseller_username, existing[0].id]
      );
      res.json({ success: true, message: 'Hosting configuration updated' });
    } else {
      // Create new
      await pool.execute(
        `INSERT INTO hosting_config 
         (whm_host, whm_username, whm_password_encrypted, whm_port, whm_ssl, reseller_username) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [whm_host, whm_username, encryptedPassword, whm_port || 2222, whm_ssl !== false, reseller_username]
      );
      res.json({ success: true, message: 'Hosting configuration saved' });
    }
  } catch (error) {
    console.error('Error saving hosting config:', error);
    res.status(500).json({ error: 'Failed to save hosting configuration' });
  }
});

// Test DirectAdmin connection
router.post('/config/test', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found' });
    }
    
    // Test connection by getting server info
    const result = await makeDirectAdminRequest(config, 'CMD_API_SHOW_RESELLER_CONFIG', {});
    res.json({ success: true, message: 'Connection successful', serverInfo: result });
  } catch (error) {
    console.error('DirectAdmin connection test failed:', error);
    res.status(500).json({ error: `Connection failed: ${error.message}` });
  }
});

// Get all hosting accounts
router.get('/accounts', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = 'SELECT * FROM hosting_accounts WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (search) {
      query += ' AND (domain LIKE ? OR username LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [accounts] = await pool.execute(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM hosting_accounts WHERE 1=1';
    const countParams = [];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    if (search) {
      countQuery += ' AND (domain LIKE ? OR username LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      accounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching hosting accounts:', error);
    res.status(500).json({ error: 'Failed to fetch hosting accounts' });
  }
});

// Sync accounts from DirectAdmin
router.post('/accounts/sync', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found. Please configure DirectAdmin first.' });
    }
    
    // Get accounts from DirectAdmin (reseller view)
    const daAccounts = await makeDirectAdminRequest(config, 'CMD_API_SHOW_RESELLER_IPS', {});
    
    // Get list of users
    const usersResult = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USERS', {});
    
    let synced = 0;
    let created = 0;
    let updated = 0;
    
    // Parse users list (can be array or object)
    const users = Array.isArray(usersResult) ? usersResult : (usersResult.users || Object.keys(usersResult).filter(k => !k.startsWith('error')));
    
    for (const username of users) {
      try {
        // Get user details
        const userInfo = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_CONFIG', { user: username });
        
        if (userInfo.error) continue;
        
        const domain = userInfo.domain || userInfo.DOMAIN || null;
        if (!domain) continue;
        
        const [existing] = await pool.execute(
          'SELECT id FROM hosting_accounts WHERE username = ? OR domain = ?',
          [username, domain]
        );
        
        // Get usage stats
        const usage = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_USAGE', { user: username }).catch(() => ({}));
        
        const accountData = {
          domain: domain,
          username: username,
          package_name: userInfo.package || userInfo.PACKAGE || 'default',
          status: userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes' ? 'suspended' : 'active',
          disk_used: parseFloat(usage.quota_used || usage.QUOTA_USED || 0) / 1024 / 1024 || 0, // Convert bytes to MB
          disk_limit: parseFloat(usage.quota || usage.QUOTA || 0) / 1024 / 1024 || 0,
          bandwidth_used: parseFloat(usage.bandwidth_used || usage.BANDWIDTH_USED || 0) / 1024 / 1024 || 0,
          bandwidth_limit: parseFloat(usage.bandwidth || usage.BANDWIDTH || 0) / 1024 / 1024 || 0,
          ip_address: userInfo.ip || userInfo.IP || null,
          cpanel_url: domain ? `https://${domain}:2222` : null, // DirectAdmin port
          whm_account_id: null,
          suspended_at: (userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes') ? new Date() : null,
        };
        
        if (existing.length > 0) {
          await pool.execute(
            `UPDATE hosting_accounts SET 
              domain = ?, package_name = ?, status = ?, 
              disk_used = ?, disk_limit = ?, bandwidth_used = ?, bandwidth_limit = ?,
              ip_address = ?, cpanel_url = ?, suspended_at = ?
             WHERE id = ?`,
            [
              accountData.domain, accountData.package_name, accountData.status,
              accountData.disk_used, accountData.disk_limit, accountData.bandwidth_used, accountData.bandwidth_limit,
              accountData.ip_address, accountData.cpanel_url, accountData.suspended_at,
              existing[0].id
            ]
          );
          updated++;
        } else {
          await pool.execute(
            `INSERT INTO hosting_accounts 
             (domain, username, package_name, status, disk_used, disk_limit, bandwidth_used, bandwidth_limit, ip_address, cpanel_url, suspended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              accountData.domain, accountData.username, accountData.package_name, accountData.status,
              accountData.disk_used, accountData.disk_limit, accountData.bandwidth_used, accountData.bandwidth_limit,
              accountData.ip_address, accountData.cpanel_url, accountData.suspended_at
            ]
          );
          created++;
        }
        synced++;
      } catch (err) {
        console.error(`Error syncing account ${username}:`, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `Synced ${synced} accounts`,
      created,
      updated,
    });
  } catch (error) {
    console.error('Error syncing accounts:', error);
    res.status(500).json({ error: `Failed to sync accounts: ${error.message}` });
  }
});

// Create new hosting account
router.post('/accounts', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found' });
    }
    
    const { domain, username, password, package_name, email, customer_name, customer_email, customer_phone, notes } = req.body;
    
    if (!domain || !username || !password || !package_name || !email) {
      return res.status(400).json({ error: 'Domain, username, password, package, and email are required' });
    }
    
    // Create account via DirectAdmin API
    const params = {
      action: 'create',
      add: 'Submit',
      username: username,
      email: email,
      passwd: password,
      passwd2: password,
      domain: domain,
      package: package_name,
      ip: 'shared', // or specific IP if available
      notify: 'yes',
    };
    
    const result = await makeDirectAdminRequest(config, 'CMD_API_ACCOUNT_USER', params, 'POST');
    
    if (result.error) {
      return res.status(400).json({ error: result.error || 'Failed to create account' });
    }
    
    // Save to database
    await pool.execute(
      `INSERT INTO hosting_accounts 
       (domain, username, package_name, status, customer_name, customer_email, customer_phone, notes)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      [domain, username, package_name, customer_name, customer_email || email, customer_phone, notes]
    );
    
    res.json({ success: true, message: 'Hosting account created successfully', account: result });
  } catch (error) {
    console.error('Error creating hosting account:', error);
    res.status(500).json({ error: `Failed to create account: ${error.message}` });
  }
});

// Suspend account
router.post('/accounts/:id/suspend', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found' });
    }
    
    const [accounts] = await pool.execute('SELECT username FROM hosting_accounts WHERE id = ?', [req.params.id]);
    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const result = await makeDirectAdminRequest(config, 'CMD_API_SUSPEND_USER', { 
      user: accounts[0].username,
      action: 'suspend'
    }, 'POST');
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    await pool.execute('UPDATE hosting_accounts SET status = "suspended", suspended_at = NOW() WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Account suspended successfully' });
  } catch (error) {
    console.error('Error suspending account:', error);
    res.status(500).json({ error: `Failed to suspend account: ${error.message}` });
  }
});

// Unsuspend account
router.post('/accounts/:id/unsuspend', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found' });
    }
    
    const [accounts] = await pool.execute('SELECT username FROM hosting_accounts WHERE id = ?', [req.params.id]);
    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const result = await makeDirectAdminRequest(config, 'CMD_API_SUSPEND_USER', { 
      user: accounts[0].username,
      action: 'unsuspend'
    }, 'POST');
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    await pool.execute('UPDATE hosting_accounts SET status = "active", suspended_at = NULL WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Account unsuspended successfully' });
  } catch (error) {
    console.error('Error unsuspending account:', error);
    res.status(500).json({ error: `Failed to unsuspend account: ${error.message}` });
  }
});

// Terminate account
router.post('/accounts/:id/terminate', async (req, res) => {
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      return res.status(400).json({ error: 'No hosting configuration found' });
    }
    
    const [accounts] = await pool.execute('SELECT username FROM hosting_accounts WHERE id = ?', [req.params.id]);
    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const result = await makeDirectAdminRequest(config, 'CMD_API_DELETE_USER', { 
      confirmed: 'Confirm',
      delete: 'yes',
      select0: accounts[0].username
    }, 'POST');
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    await pool.execute('UPDATE hosting_accounts SET status = "terminated" WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Account terminated successfully' });
  } catch (error) {
    console.error('Error terminating account:', error);
    res.status(500).json({ error: `Failed to terminate account: ${error.message}` });
  }
});

// Update account details
router.put('/accounts/:id', async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, notes, expires_at } = req.body;
    
    await pool.execute(
      `UPDATE hosting_accounts SET 
        customer_name = ?, customer_email = ?, customer_phone = ?, notes = ?, expires_at = ?
       WHERE id = ?`,
      [customer_name, customer_email, customer_phone, notes, expires_at, req.params.id]
    );
    
    res.json({ success: true, message: 'Account updated successfully' });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Get account statistics
router.get('/accounts/stats', async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
        SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(disk_used) as total_disk_used,
        SUM(disk_limit) as total_disk_limit,
        SUM(bandwidth_used) as total_bandwidth_used,
        SUM(bandwidth_limit) as total_bandwidth_limit
      FROM hosting_accounts
    `);
    
    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

