const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { defaultLogger, syncLogger, directAdminLogger } = require('../utils/logger');

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
    
    directAdminLogger.log(`Making ${method} request to ${hostname}:${port}`);
    directAdminLogger.log(`Command: ${command}`);
    directAdminLogger.log(`Using ${trySSL ? 'HTTPS' : 'HTTP'}`);
    if (Object.keys(params).length > 0) {
      directAdminLogger.debug(`Params:`, params);
    }
    
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
        
        directAdminLogger.log(`Response status: ${res.statusCode}`);
        directAdminLogger.debug(`Response headers:`, res.headers);
        
        // Check if response is valid HTTP
        if (res.statusCode === undefined) {
          return reject(new Error('Invalid HTTP response from server. Check host and port.'));
        }
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            directAdminLogger.debug(`Raw response length: ${data.length} bytes`);
            directAdminLogger.debug(`Raw response (first 500 chars):`, data.substring(0, 500));
            
            // Check for HTTP error status
            if (res.statusCode >= 400) {
              directAdminLogger.error(`HTTP Error ${res.statusCode}:`, data.substring(0, 500));
              return reject(new Error(`DirectAdmin API returned status ${res.statusCode}: ${data.substring(0, 200)}`));
            }
            
            // DirectAdmin can return JSON or key=value format
            if (data.trim().startsWith('{')) {
              const json = JSON.parse(data);
              directAdminLogger.debug(`Parsed JSON response:`, json);
              if (json.error) {
                directAdminLogger.error(`JSON error:`, json.error);
                reject(new Error(json.error || 'DirectAdmin API error'));
              } else {
                resolve(json);
              }
            } else {
              // Parse key=value format
              const result = {};
              
              // Check if data is in single-line URL-encoded format (key=value&key=value&...)
              // This is common in DirectAdmin responses
              const isSingleLineUrlEncoded = data.includes('&') && data.includes('=') && !data.includes('\n') && data.split('&').length > 3;
              
              if (isSingleLineUrlEncoded) {
                directAdminLogger.log(`Detected single-line URL-encoded format`);
                try {
                  // Parse as URL-encoded query string
                  const urlParams = new URLSearchParams(data);
                  
                  // First, check if there are list[] entries (for CMD_API_SHOW_USERS)
                  const listValues = urlParams.getAll('list[]');
                  if (listValues.length > 0) {
                    directAdminLogger.log(`Found ${listValues.length} users in list[] format`);
                    result.list = listValues;
                    // Also add them as list[0], list[1], etc. for compatibility
                    listValues.forEach((user, index) => {
                      result[`list[${index}]`] = user;
                    });
                  }
                  
                  // Parse all other key-value pairs
                  for (const [key, value] of urlParams.entries()) {
                    // Skip if already processed as list[]
                    if (key === 'list[]') continue;
                    
                    // Try to parse as number or boolean
                    let parsedValue = value;
                    if (value === 'yes') parsedValue = true;
                    else if (value === 'no') parsedValue = false;
                    else if (!isNaN(value) && value !== '') parsedValue = parseFloat(value);
                    result[key] = parsedValue;
                  }
                  directAdminLogger.log(`Parsed ${Object.keys(result).length} key-value pairs from URL-encoded format`);
                } catch (urlErr) {
                  directAdminLogger.warn(`Failed to parse as URLSearchParams, trying manual parsing:`, urlErr.message);
                  // Fallback: manual parsing
                  const parts = data.split('&');
                  const listUsers = [];
                  
                  for (const part of parts) {
                    const [key, ...valueParts] = part.split('=');
                    if (key && valueParts.length > 0) {
                      let value = decodeURIComponent(valueParts.join('='));
                      
                      // Check if it's a list[] entry
                      if (key === 'list[]' || key.toLowerCase() === 'list%5b%5d') {
                        listUsers.push(value);
                        continue;
                      }
                      
                      // Try to parse as number or boolean
                      if (value === 'yes') value = true;
                      else if (value === 'no') value = false;
                      else if (!isNaN(value) && value !== '') value = parseFloat(value);
                      result[key] = value;
                    }
                  }
                  
                  if (listUsers.length > 0) {
                    directAdminLogger.log(`Found ${listUsers.length} users in manual parsing`);
                    result.list = listUsers;
                    listUsers.forEach((user, index) => {
                      result[`list[${index}]`] = user;
                    });
                  }
                }
              } else {
                // Parse multi-line key=value format
                const lines = data.split('\n');
                directAdminLogger.log(`Parsing key=value format, ${lines.length} lines`);
                
                // Also check if data contains URL-encoded format (list[]=user1&list[]=user2)
                // Or mixed format (user1&list[]=user2&list[]=user3)
                if (data.includes('list[]=') || data.includes('list%5B%5D=') || data.includes('&list')) {
                directAdminLogger.log(`Detected URL-encoded list format, parsing...`);
                try {
                  // The data might be in format: user1&list[]=user2&list[]=user3
                  // Or: list[]=user1&list[]=user2
                  // Try to parse as URL-encoded query string
                  
                  // Handle mixed format: user1&list[]=user2&list[]=user3
                  // Or pure format: list[]=user1&list[]=user2
                  
                  // Split by & to process each part
                  const parts = data.trim().split('&');
                  const users = [];
                  
                  for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed) continue;
                    
                    // Check if it's in list[]=username format
                    if (trimmed.startsWith('list[]=') || trimmed.startsWith('list%5B%5D=') || trimmed.toLowerCase().startsWith('list%5b%5d%3d')) {
                      let username = trimmed;
                      // Remove list[]= prefix (handle both encoded and non-encoded)
                      username = username.replace(/^list\[\]=/i, '')
                                         .replace(/^list%5B%5D%3D/i, '')
                                         .replace(/^list%5b%5d%3d/i, '');
                      // URL decode
                      try {
                        username = decodeURIComponent(username);
                      } catch (e) {
                        // If decode fails, try basic replacements
                        username = username.replace(/%20/g, ' ').replace(/%26/g, '&');
                      }
                      // Clean up any remaining encoding artifacts
                      username = username.split('&')[0].split('=')[0].trim();
                      if (username && !username.includes('%') && username.length > 0) {
                        users.push(username);
                        directAdminLogger.debug(`Extracted username from list[]: ${username}`);
                      }
                    } else if (!trimmed.includes('=') && !trimmed.includes('%') && trimmed.length > 0) {
                      // It's a plain username (first one in mixed format like: user1&list[]=user2)
                      // Make sure it's not part of a key=value pair
                      if (!trimmed.match(/^[a-zA-Z0-9_\-\.]+$/)) {
                        // Skip if it contains invalid characters for a username
                        continue;
                      }
                      users.push(trimmed);
                      directAdminLogger.debug(`Extracted plain username: ${trimmed}`);
                    }
                  }
                  
                  if (users.length > 0) {
                    directAdminLogger.log(`Found ${users.length} users in URL-encoded format:`, users);
                    result.list = users;
                    // Also add them as list[0], list[1], etc. for compatibility
                    users.forEach((user, index) => {
                      result[`list[${index}]`] = user;
                    });
                  }
                } catch (urlErr) {
                  directAdminLogger.warn(`Failed to parse URL-encoded format:`, urlErr.message);
                  directAdminLogger.error(`Error stack:`, urlErr.stack);
                }
                }
                
                // Parse standard key=value lines
                for (const line of lines) {
                  const match = line.match(/^([^=]+)=(.*)$/);
                  if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    
                    // Skip if already processed from URL-encoded format
                    if (key.startsWith('list[') && result.list) {
                      continue;
                    }
                    
                    // URL decode the value if needed
                    try {
                      value = decodeURIComponent(value);
                    } catch (e) {
                      // If decoding fails, use original value
                    }
                    
                    // Try to parse as number or boolean
                    if (value === 'yes') value = true;
                    else if (value === 'no') value = false;
                    else if (!isNaN(value) && value !== '') value = parseFloat(value);
                    
                    result[key] = value;
                  }
                }
              }
              
              directAdminLogger.log(`Parsed ${Object.keys(result).length} key-value pairs`);
              directAdminLogger.debug(`Parsed result:`, result);
              resolve(result);
            }
          } catch (error) {
            directAdminLogger.error(`Parse error:`, error.message);
            directAdminLogger.error(`Raw data:`, data.substring(0, 1000));
            // If parsing fails, return raw data
            if (data.includes('error=')) {
              const errorMatch = data.match(/error=([^\n]+)/);
              reject(new Error(errorMatch ? errorMatch[1] : 'DirectAdmin API error'));
            } else {
              reject(new Error(`Failed to parse DirectAdmin response: ${error.message}. Response: ${data.substring(0, 200)}`));
            }
          }
        });
      });
      
      request.on('error', (error) => {
        directAdminLogger.error(`Request error:`, error.message);
        directAdminLogger.error(`Error code:`, error.code);
        // If SSL error and we tried SSL, retry with HTTP
        if (useSSL && (error.code === 'ECONNRESET' || error.message.includes('wrong version number') || error.message.includes('SSL') || error.message.includes('Parse Error'))) {
          directAdminLogger.warn(`SSL connection failed (${error.message}), retrying with HTTP for ${hostname}:${port}`);
          makeRequest(false);
        } else {
          directAdminLogger.error(`Request failed permanently:`, error);
          reject(new Error(`DirectAdmin request failed: ${error.message}. Check if DirectAdmin is running on ${hostname}:${port} and the credentials are correct.`));
        }
      });
      
      // Set timeout to prevent hanging
      request.setTimeout(10000, () => {
        directAdminLogger.error(`Request timeout after 10 seconds`);
        request.destroy();
        reject(new Error(`Request timeout after 10 seconds. Check if DirectAdmin is accessible at ${hostname}:${port}`));
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
    defaultLogger.error('Error fetching hosting config:', error);
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
    defaultLogger.error('Error saving hosting config:', error);
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
    
    // Test connection - try a simple command first
    // DirectAdmin API commands vary, try different commands based on user type
    let result;
    try {
      // Try to get reseller config first (for reseller accounts)
      result = await makeDirectAdminRequest(config, 'CMD_API_SHOW_RESELLER_CONFIG', {});
    } catch (err) {
      // If that fails, try a simpler command - verify password
      try {
        const password = decryptPassword(config.whm_password_encrypted);
        result = await makeDirectAdminRequest(config, 'CMD_API_VERIFY_PASSWORD', {
          user: config.whm_username,
          passwd: password
        }, 'POST');
      } catch (err2) {
        // Last resort - try to list users (should work for reseller/admin)
        result = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USERS', {});
      }
    }
    
    res.json({ success: true, message: 'Connection successful', serverInfo: result });
  } catch (error) {
    directAdminLogger.error('DirectAdmin connection test failed:', error);
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
    defaultLogger.error('Error fetching hosting accounts:', error);
    res.status(500).json({ error: 'Failed to fetch hosting accounts' });
  }
});

// Sync accounts from DirectAdmin
router.post('/accounts/sync', async (req, res) => {
  syncLogger.log('========================================');
  syncLogger.log('Starting DirectAdmin account sync');
  syncLogger.log('========================================');
  
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      syncLogger.error('No hosting configuration found');
      return res.status(400).json({ error: 'No hosting configuration found. Please configure DirectAdmin first.' });
    }
    
    syncLogger.log('Configuration loaded:');
    syncLogger.log(`  - Host: ${config.whm_host}`);
    syncLogger.log(`  - Port: ${config.whm_port || 2222}`);
    syncLogger.log(`  - SSL: ${config.whm_ssl !== false}`);
    syncLogger.log(`  - Username: ${config.whm_username}`);
    syncLogger.log(`  - Reseller: ${config.reseller_username || 'N/A'}`);
    
    // Get list of users from DirectAdmin
    syncLogger.log('Fetching users list from DirectAdmin...');
    const usersResult = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USERS', {});
    
    syncLogger.log(`Raw DirectAdmin response type: ${typeof usersResult}`);
    syncLogger.debug('Raw DirectAdmin response:', usersResult);
    syncLogger.debug('Response keys:', Object.keys(usersResult || {}));
    
    let synced = 0;
    let created = 0;
    let updated = 0;
    
    // Parse users list - DirectAdmin returns in format: list[0]=user1, list[1]=user2, etc.
    let users = [];
    
    syncLogger.log('Parsing users list...');
    
    if (Array.isArray(usersResult)) {
      syncLogger.log('Response is an array');
      users = usersResult;
    } else if (usersResult.users && Array.isArray(usersResult.users)) {
      syncLogger.log('Response has users array property');
      users = usersResult.users;
    } else if (typeof usersResult === 'object' && usersResult !== null) {
      syncLogger.log('Response is an object, parsing...');
      syncLogger.debug('Full response:', usersResult);
      
      // IMPORTANT: For CMD_API_SHOW_USERS, DirectAdmin typically returns:
      // - list[]=user1&list[]=user2&... (URL-encoded format) - parsed into usersResult.list
      // - OR list[0]=user1&list[1]=user2&... (indexed format)
      // - OR multiple separate user objects
      
      // First priority: Check if there's a 'list' array (from URL-encoded parsing)
      if (Array.isArray(usersResult.list)) {
        syncLogger.log(`Found list array property with ${usersResult.list.length} users`);
        users = usersResult.list.filter(Boolean);
        syncLogger.log(`Extracted ${users.length} users from list array`);
      } 
      // Second: Check for indexed list keys (list[0], list[1], etc.)
      else {
        const listKeys = Object.keys(usersResult).filter(k => {
          const lowerKey = k.toLowerCase();
          return lowerKey.startsWith('list[') || lowerKey.startsWith('user[') || lowerKey.startsWith('username[');
        });
        
        if (listKeys.length > 0) {
          syncLogger.log(`Found ${listKeys.length} list keys:`, listKeys);
          // Extract usernames from list[0], list[1], etc.
          users = listKeys
            .sort((a, b) => {
              const numA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
              const numB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
              return numA - numB;
            })
            .map(key => {
              const value = usersResult[key];
              syncLogger.debug(`  ${key} = ${value}`);
              // Clean up value - remove URL encoding artifacts
              if (typeof value === 'string') {
                // Remove any URL-encoded parts that might be stuck
                const cleaned = value.split('&')[0].split('=')[0];
                return cleaned || value;
              }
              return value;
            })
            .filter(Boolean)
            .filter(u => {
              // Filter out invalid usernames (URL-encoded strings, etc.)
              if (typeof u !== 'string') return false;
              // Username should not contain &, =, or % (URL encoding artifacts)
              if (u.includes('&') || u.includes('=') || u.includes('%')) {
                syncLogger.warn(`  ⚠️  Skipping invalid username (contains URL encoding): ${u}`);
                return false;
              }
              return true;
            });
          syncLogger.log(`Extracted ${users.length} users from list keys`);
        }
        // Third: Check if response contains a single username field
        else if (usersResult.username && typeof usersResult.username === 'string') {
          syncLogger.log(`Found single user object with username: ${usersResult.username}`);
          users = [usersResult.username];
        }
        // Fourth: Try alternative parsing
        else {
          syncLogger.log('No list keys found, trying alternative parsing...');
          syncLogger.debug('All response keys:', Object.keys(usersResult));
          
          // Try to extract usernames from other keys (excluding error, etc.)
          const excludedKeys = ['error', 'ERROR', 'list', 'LIST', 'success', 'SUCCESS', 'text', 'TEXT', 'account', 'domain', 'package', 'ip', 'email', 'quota', 'bandwidth'];
          const candidateKeys = Object.keys(usersResult).filter(k => {
            const upperKey = k.toUpperCase();
            return !excludedKeys.some(ex => upperKey.includes(ex));
          });
          
          syncLogger.debug(`Candidate keys (${candidateKeys.length}):`, candidateKeys);
          
          // Check if 'username' key exists (common in DirectAdmin responses)
          if (usersResult.username) {
            const usernameValue = usersResult.username;
            if (typeof usernameValue === 'string' && usernameValue.length > 0) {
              users.push(usernameValue);
              syncLogger.log(`Found username field: ${usernameValue}`);
            } else if (Array.isArray(usernameValue)) {
              users.push(...usernameValue.filter(u => typeof u === 'string' && u.length > 0));
              syncLogger.log(`Found username array with ${users.length} users`);
            }
          }
          
          // Also check other candidate keys
          const additionalUsers = candidateKeys
            .map(key => {
              const value = usersResult[key];
              syncLogger.debug(`  Checking key "${key}": value="${value}" (type: ${typeof value})`);
              
              // If value looks like a username (not a number, not yes/no, not empty, not a common config key)
              if (typeof value === 'string' && value.length > 0 && value !== 'yes' && value !== 'no' && isNaN(value) && !value.includes('=') && !value.includes('&') && !value.includes('%')) {
                // Additional validation: username should be alphanumeric with possible underscores/dots
                if (value.match(/^[a-zA-Z0-9_\-\.]+$/) && value.length >= 3 && value.length <= 32) {
                  syncLogger.debug(`    ✓ Valid username: ${value}`);
                  return value;
                }
              }
              return null;
            })
            .filter(Boolean);
          
          // Merge and deduplicate
          users = [...new Set([...users, ...additionalUsers])];
          syncLogger.log(`Extracted ${users.length} unique users from candidate keys`);
        }
      }
    } else {
      syncLogger.error(`Unexpected response type: ${typeof usersResult}`);
    }
    
    syncLogger.log(`Total users found: ${users.length}`);
    syncLogger.log(`Users list:`, users);
    
    if (users.length === 0) {
      syncLogger.warn('No users found to sync!');
      syncLogger.warn('This might indicate:');
      syncLogger.warn('  1. No accounts exist in DirectAdmin');
      syncLogger.warn('  2. The API response format is different than expected');
      syncLogger.warn('  3. The user does not have permission to list users');
      syncLogger.warn('  4. The API command returned an error');
      
      return res.json({
        success: true,
        message: 'No users found to sync',
        created: 0,
        updated: 0,
        synced: 0,
        debug: {
          responseType: typeof usersResult,
          responseKeys: usersResult ? Object.keys(usersResult) : [],
          rawResponse: usersResult
        }
      });
    }
    
    syncLogger.log('Processing users...');
    
    for (let i = 0; i < users.length; i++) {
      const username = users[i];
      syncLogger.log(`[${i + 1}/${users.length}] Processing user: ${username}`);
      
      try {
        if (!username || typeof username !== 'string') {
          syncLogger.warn(`  ⚠️  Skipping invalid username:`, username);
          continue;
        }
        
        // Get user details
        syncLogger.log(`  Fetching user config for: ${username}`);
        const userInfo = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_CONFIG', { user: username });
        syncLogger.debug(`  User config received:`, userInfo);
        
        if (userInfo.error || userInfo.ERROR) {
          syncLogger.error(`  ❌ Error getting user info for ${username}:`, userInfo.error || userInfo.ERROR);
          continue;
        }
        
        const domain = userInfo.domain || userInfo.DOMAIN || userInfo.name || null;
        syncLogger.log(`  Domain for ${username}: ${domain}`);
        
        if (!domain) {
          syncLogger.warn(`  ⚠️  No domain found for user ${username}, skipping`);
          syncLogger.warn(`  Available keys:`, Object.keys(userInfo));
          continue;
        }
        
        // Check if account already exists
        const [existing] = await pool.execute(
          'SELECT id FROM hosting_accounts WHERE username = ? OR domain = ?',
          [username, domain]
        );
        syncLogger.log(`  Existing account check: ${existing.length > 0 ? 'Found' : 'New'}`);
        
        // Get usage stats
        syncLogger.log(`  Fetching usage stats for: ${username}`);
        let usage = {};
        try {
          usage = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_USAGE', { user: username });
          syncLogger.debug(`  Usage stats received:`, usage);
          syncLogger.debug(`  Usage stats keys:`, Object.keys(usage));
          syncLogger.debug(`  Usage stats full data:`, JSON.stringify(usage, null, 2));
        } catch (usageErr) {
          syncLogger.warn(`  ⚠️  Could not fetch usage stats:`, usageErr.message);
          usage = {};
        }
        
        // IMPORTANT: DirectAdmin often returns quota/disk info in userInfo (CMD_API_SHOW_USER_CONFIG)
        // not in usage (CMD_API_SHOW_USER_USAGE). Check userInfo first!
        syncLogger.debug(`  UserInfo full data:`, JSON.stringify(userInfo, null, 2));
        syncLogger.debug(`  UserInfo keys:`, Object.keys(userInfo));
        
        // Check userInfo for quota values - this is often where they are!
        if (userInfo.quota || userInfo.QUOTA || userInfo.quota_mb || userInfo.quota_gb) {
          syncLogger.log(`  Quota found in userInfo!`);
        }
        
        // Parse usage data - DirectAdmin returns in various formats
        // Common field names: quota_used, quota, bandwidth_used, bandwidth
        // Values can be in bytes, KB, MB, GB, or as strings like "unlimited"
        // Also check userInfo as quota might be there
        let diskUsed = 0;
        let diskLimit = 0;
        let bandwidthUsed = 0;
        let bandwidthLimit = 0;
        
        // Merge usage and userInfo to check all possible sources
        // IMPORTANT: userInfo often contains quota, so merge with userInfo taking priority for quota
        const allData = { ...usage, ...userInfo };
        
        // Log all keys to help debug
        syncLogger.info(`  All available keys in usage:`, Object.keys(usage));
        syncLogger.info(`  All available keys in userInfo:`, Object.keys(userInfo));
        
        // Log specific quota-related fields from both sources
        syncLogger.debug(`  Quota fields in userInfo:`, {
          quota: userInfo.quota,
          QUOTA: userInfo.QUOTA,
          quota_mb: userInfo.quota_mb,
          quota_gb: userInfo.quota_gb,
          quota_bytes: userInfo.quota_bytes,
          limit: userInfo.limit,
          LIMIT: userInfo.LIMIT,
          quota_limit: userInfo.quota_limit
        });
        syncLogger.debug(`  Quota fields in usage:`, {
          quota: usage.quota,
          QUOTA: usage.QUOTA,
          quota_mb: usage.quota_mb,
          quota_gb: usage.quota_gb,
          quota_bytes: usage.quota_bytes,
          limit: usage.limit,
          LIMIT: usage.LIMIT
        });
        
        // IMPORTANT: Based on user feedback, usage.quota contains the USED disk amount!
        // So we need:
        // - disk_used: usage.quota (the used amount) - USER CONFIRMED THIS IS CORRECT
        // - disk_limit: userInfo.quota or another field (the total/limit size like 1.07GB)
        
        // For disk USED: usage.quota is the correct field (user confirmed)
        const quotaUsed = usage.quota || usage.QUOTA || 
          usage.quota_used || usage.QUOTA_USED || 
          usage.quota_used_mb || usage.QUOTA_USED_MB || 
          usage.quota_used_bytes || usage.QUOTA_USED_BYTES || 
          usage.quota_used_gb || usage.QUOTA_USED_GB || 
          usage.used || usage.USED || 
          userInfo.quota_used || userInfo.QUOTA_USED || 0;
        
        // For disk LIMIT (total size like 1.07GB): check userInfo first
        const quotaLimitFromUserInfo = userInfo.quota || userInfo.QUOTA || 
          userInfo.quota_mb || userInfo.QUOTA_MB || 
          userInfo.quota_gb || userInfo.QUOTA_GB || 
          userInfo.quota_bytes || userInfo.QUOTA_BYTES ||
          userInfo.limit || userInfo.LIMIT || 
          userInfo.quota_limit || userInfo.QUOTA_LIMIT ||
          userInfo.quota_limit_mb || userInfo.QUOTA_LIMIT_MB ||
          userInfo.quota_limit_gb || userInfo.QUOTA_LIMIT_GB || 0;
        
        // Also check usage for limit fields (but NOT usage.quota as that's the used amount)
        const quotaLimitFromUsage = usage.quota_limit || usage.QUOTA_LIMIT ||
          usage.quota_mb || usage.QUOTA_MB || 
          usage.quota_gb || usage.QUOTA_GB || 
          usage.limit || usage.LIMIT || 0;
        
        const quota = quotaLimitFromUserInfo || quotaLimitFromUsage;
        
        syncLogger.debug(`  Quota search results:`, {
          quotaUsed: quotaUsed,
          quotaLimitFromUserInfo: quotaLimitFromUserInfo,
          quotaLimitFromUsage: quotaLimitFromUsage,
          finalQuotaLimit: quota
        });
        
        // For bandwidth USED: check usage first (similar to disk usage)
        const bandwidthUsedVal = usage.bandwidth_used || usage.BANDWIDTH_USED || 
          usage.bandwidth_used_mb || usage.BANDWIDTH_USED_MB || 
          usage.bandwidth_used_bytes || usage.BANDWIDTH_USED_BYTES || 
          usage.bandwidth_used_gb || usage.BANDWIDTH_USED_GB || 
          usage.bandwidth || usage.BANDWIDTH ||  // Some DirectAdmin versions use bandwidth for used
          userInfo.bandwidth_used || userInfo.BANDWIDTH_USED || 0;
        
        // For bandwidth LIMIT: check userInfo first (similar to disk limit)
        const bandwidthLimitFromUserInfo = userInfo.bandwidth || userInfo.BANDWIDTH || 
          userInfo.bandwidth_mb || userInfo.BANDWIDTH_MB || 
          userInfo.bandwidth_gb || userInfo.BANDWIDTH_GB || 
          userInfo.bandwidth_bytes || userInfo.BANDWIDTH_BYTES ||
          userInfo.bandwidth_limit || userInfo.BANDWIDTH_LIMIT ||
          userInfo.bandwidth_limit_mb || userInfo.BANDWIDTH_LIMIT_MB ||
          userInfo.bandwidth_limit_gb || userInfo.BANDWIDTH_LIMIT_GB || 0;
        
        // Also check usage for limit fields (but NOT usage.bandwidth if it's the used amount)
        const bandwidthLimitFromUsage = usage.bandwidth_limit || usage.BANDWIDTH_LIMIT ||
          usage.bandwidth_mb || usage.BANDWIDTH_MB || 
          usage.bandwidth_gb || usage.BANDWIDTH_GB || 0;
        
        const bandwidth = bandwidthLimitFromUserInfo || bandwidthLimitFromUsage;
        
        syncLogger.debug(`  Bandwidth search results:`, {
          bandwidthUsedVal: bandwidthUsedVal,
          bandwidthLimitFromUserInfo: bandwidthLimitFromUserInfo,
          bandwidthLimitFromUsage: bandwidthLimitFromUsage,
          finalBandwidthLimit: bandwidth
        });
        
        syncLogger.debug(`  Final quota values:`, {
          quotaLimitFromUserInfo,
          quotaLimitFromUsage,
          finalQuotaLimit: quota,
          quotaUsed,
          bandwidth,
          bandwidthUsedVal
        });
        
        // Helper function to convert value to MB
        // DirectAdmin can return values in bytes, KB, MB, or GB
        // Based on user feedback: 1.07GB total disk, 1000.5MB used disk
        // For bandwidth: 1.09 MB (not GB!), 25.4 MB is correct
        const convertToMB = (value, fieldName = '') => {
          if (!value || value === 'unlimited' || value === 'UNLIMITED' || value === '0' || value === 0) {
            return 0;
          }
          
          // Check if field name indicates unit (e.g., quota_gb, bandwidth_gb)
          const isGB = fieldName.toLowerCase().includes('_gb') || fieldName.toLowerCase().includes('gb');
          const isMB = fieldName.toLowerCase().includes('_mb') || fieldName.toLowerCase().includes('mb');
          const isKB = fieldName.toLowerCase().includes('_kb') || fieldName.toLowerCase().includes('kb');
          const isBytes = fieldName.toLowerCase().includes('_bytes') || fieldName.toLowerCase().includes('bytes');
          
          // Check if this is a bandwidth field (bandwidth values are usually smaller and in MB)
          const isBandwidth = fieldName.toLowerCase().includes('bandwidth');
          
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) {
            return 0;
          }
          
          // If field name indicates unit, use that (highest priority)
          if (isGB) {
            return num * 1024; // GB to MB
          } else if (isMB) {
            return num; // Already in MB
          } else if (isKB) {
            return num / 1024; // KB to MB
          } else if (isBytes) {
            return num / 1024 / 1024; // Bytes to MB
          }
          
          // Otherwise, detect based on value ranges and field type
          if (num > 1000000000) {
            // Over 1GB - definitely bytes, convert to MB
            return num / 1024 / 1024;
          } else if (num > 1000000) {
            // Between 1MB and 1GB - likely bytes, convert to MB
            return num / 1024 / 1024;
          } else if (num > 10000) {
            // Between 10MB and 1MB - likely KB (e.g., 747520 KB), convert to MB
            return num / 1024;
          } else if (num > 1000) {
            // Between 1MB and 10MB - could be KB or MB
            // If it's a round number > 5000, likely KB
            // Otherwise likely MB (e.g., 1000.5 MB, 1100 MB)
            if (num % 1 === 0 && num > 5000) {
              return num / 1024; // KB to MB
            } else {
              return num; // Already in MB
            }
          } else if (num >= 1 && num <= 10) {
            // Values between 1-10: Need to distinguish between disk quota (GB) and bandwidth (MB)
            // For DISK QUOTA: values like 1.07, 2.5 are likely GB (total disk size)
            // For BANDWIDTH: values like 1.09, 25.4 are likely MB (bandwidth usage)
            
            if (isBandwidth) {
              // For bandwidth, values 1-10 are almost always MB, not GB
              // User confirmed: 1.09 MB (not GB), 25.4 MB is correct
              return num; // Already in MB
            } else {
              // For disk quota, check if it's likely GB
              // Disk quotas can be 1.07 GB (total), but used is usually in MB (1000.5 MB)
              // If it has decimals and is < 5, might be GB for total quota
              // But if field name suggests "used", it's likely MB
              const isUsed = fieldName.toLowerCase().includes('used') || 
                            fieldName.toLowerCase().includes('quota') && !fieldName.toLowerCase().includes('limit');
              
              if (isUsed) {
                // For "used" values, they're usually in MB
                return num; // Already in MB
              } else if (num % 1 !== 0 && num < 5) {
                // For total/limit values, decimal values like 1.07, 2.5 might be GB
                return num * 1024; // GB to MB
              } else {
                // Round number 1-10 or > 5 - likely MB
                return num;
              }
            }
          } else {
            // Less than 1 - likely already in MB (e.g., 0.5 MB, 0.86 MB)
            return num;
          }
        };
        
        // Find which field actually contains the quota LIMIT value (total disk size)
        // Priority: quota_gb > quota_mb > quota > QUOTA > limit
        // NOTE: Do NOT use usage.quota as that's the USED amount, not the limit!
        let quotaFieldName = '';
        let quotaValue = 0;
        
        // Check userInfo first for limit
        if (userInfo.quota_gb || userInfo.QUOTA_GB) {
          quotaFieldName = userInfo.quota_gb ? 'quota_gb' : 'QUOTA_GB';
          quotaValue = userInfo.quota_gb || userInfo.QUOTA_GB;
        } else if (userInfo.quota_mb || userInfo.QUOTA_MB) {
          quotaFieldName = userInfo.quota_mb ? 'quota_mb' : 'QUOTA_MB';
          quotaValue = userInfo.quota_mb || userInfo.QUOTA_MB;
        } else if (userInfo.quota || userInfo.QUOTA) {
          quotaFieldName = userInfo.quota ? 'quota' : 'QUOTA';
          quotaValue = userInfo.quota || userInfo.QUOTA;
        } else if (userInfo.limit || userInfo.LIMIT) {
          quotaFieldName = userInfo.limit ? 'limit' : 'LIMIT';
          quotaValue = userInfo.limit || userInfo.LIMIT;
        } else if (userInfo.quota_limit || userInfo.QUOTA_LIMIT) {
          quotaFieldName = userInfo.quota_limit ? 'quota_limit' : 'QUOTA_LIMIT';
          quotaValue = userInfo.quota_limit || userInfo.QUOTA_LIMIT;
        } else if (usage.quota_limit || usage.QUOTA_LIMIT) {
          quotaFieldName = usage.quota_limit ? 'quota_limit' : 'QUOTA_LIMIT';
          quotaValue = usage.quota_limit || usage.QUOTA_LIMIT;
        } else if (usage.quota_gb || usage.QUOTA_GB) {
          quotaFieldName = usage.quota_gb ? 'quota_gb' : 'QUOTA_GB';
          quotaValue = usage.quota_gb || usage.QUOTA_GB;
        } else if (usage.quota_mb || usage.QUOTA_MB) {
          quotaFieldName = usage.quota_mb ? 'quota_mb' : 'QUOTA_MB';
          quotaValue = usage.quota_mb || usage.QUOTA_MB;
        } else if (usage.limit || usage.LIMIT) {
          quotaFieldName = usage.limit ? 'limit' : 'LIMIT';
          quotaValue = usage.limit || usage.LIMIT;
        }
        
        // If quota is still 0, use the fallback
        if (!quotaValue || quotaValue === 0) {
          quotaValue = quota;
        }
        
        // Find which field contains the quota USED value (disk used)
        // NOTE: usage.quota is the USED amount (user confirmed this)
        let quotaUsedFieldName = '';
        let quotaUsedValue = 0;
        
        if (usage.quota || usage.QUOTA) {
          // usage.quota is the USED amount (confirmed by user)
          quotaUsedFieldName = usage.quota ? 'quota' : 'QUOTA';
          quotaUsedValue = usage.quota || usage.QUOTA;
        } else if (usage.quota_used_gb || usage.QUOTA_USED_GB) {
          quotaUsedFieldName = usage.quota_used_gb ? 'quota_used_gb' : 'QUOTA_USED_GB';
          quotaUsedValue = usage.quota_used_gb || usage.QUOTA_USED_GB;
        } else if (usage.quota_used_mb || usage.QUOTA_USED_MB) {
          quotaUsedFieldName = usage.quota_used_mb ? 'quota_used_mb' : 'QUOTA_USED_MB';
          quotaUsedValue = usage.quota_used_mb || usage.QUOTA_USED_MB;
        } else if (usage.quota_used || usage.QUOTA_USED) {
          quotaUsedFieldName = usage.quota_used ? 'quota_used' : 'QUOTA_USED';
          quotaUsedValue = usage.quota_used || usage.QUOTA_USED;
        } else if (usage.used || usage.USED) {
          quotaUsedFieldName = usage.used ? 'used' : 'USED';
          quotaUsedValue = usage.used || usage.USED;
        } else if (userInfo.quota_used || userInfo.QUOTA_USED) {
          quotaUsedFieldName = userInfo.quota_used ? 'quota_used' : 'QUOTA_USED';
          quotaUsedValue = userInfo.quota_used || userInfo.QUOTA_USED;
        }
        
        // If quotaUsed is still 0, use the fallback
        if (!quotaUsedValue || quotaUsedValue === 0) {
          quotaUsedValue = quotaUsed;
        }
        
        // Parse disk usage with field name context
        diskUsed = convertToMB(quotaUsedValue, quotaUsedFieldName);
        diskLimit = convertToMB(quotaValue, quotaFieldName);
        
        syncLogger.log(`  Disk USED: ${quotaUsedValue} from field "${quotaUsedFieldName}" → ${diskUsed.toFixed(2)} MB`);
        syncLogger.log(`  Disk LIMIT: ${quotaValue} from field "${quotaFieldName}" → ${diskLimit.toFixed(2)} MB`);
        
        // Find which field contains the bandwidth USED value
        let bandwidthUsedFieldName = '';
        let bandwidthUsedValue = 0;
        
        if (usage.bandwidth_used || usage.BANDWIDTH_USED) {
          bandwidthUsedFieldName = usage.bandwidth_used ? 'bandwidth_used' : 'BANDWIDTH_USED';
          bandwidthUsedValue = usage.bandwidth_used || usage.BANDWIDTH_USED;
        } else if (usage.bandwidth_used_gb || usage.BANDWIDTH_USED_GB) {
          bandwidthUsedFieldName = usage.bandwidth_used_gb ? 'bandwidth_used_gb' : 'BANDWIDTH_USED_GB';
          bandwidthUsedValue = usage.bandwidth_used_gb || usage.BANDWIDTH_USED_GB;
        } else if (usage.bandwidth_used_mb || usage.BANDWIDTH_USED_MB) {
          bandwidthUsedFieldName = usage.bandwidth_used_mb ? 'bandwidth_used_mb' : 'BANDWIDTH_USED_MB';
          bandwidthUsedValue = usage.bandwidth_used_mb || usage.BANDWIDTH_USED_MB;
        } else if (usage.bandwidth || usage.BANDWIDTH) {
          // Some DirectAdmin versions use bandwidth for used amount
          bandwidthUsedFieldName = usage.bandwidth ? 'bandwidth' : 'BANDWIDTH';
          bandwidthUsedValue = usage.bandwidth || usage.BANDWIDTH;
        } else if (userInfo.bandwidth_used || userInfo.BANDWIDTH_USED) {
          bandwidthUsedFieldName = userInfo.bandwidth_used ? 'bandwidth_used' : 'BANDWIDTH_USED';
          bandwidthUsedValue = userInfo.bandwidth_used || userInfo.BANDWIDTH_USED;
        }
        
        // If bandwidthUsed is still 0, use the fallback
        if (!bandwidthUsedValue || bandwidthUsedValue === 0) {
          bandwidthUsedValue = bandwidthUsedVal;
        }
        
        // Find which field contains the bandwidth LIMIT value
        let bandwidthFieldName = '';
        let bandwidthValue = 0;
        
        // Check userInfo first for limit
        if (userInfo.bandwidth_gb || userInfo.BANDWIDTH_GB) {
          bandwidthFieldName = userInfo.bandwidth_gb ? 'bandwidth_gb' : 'BANDWIDTH_GB';
          bandwidthValue = userInfo.bandwidth_gb || userInfo.BANDWIDTH_GB;
        } else if (userInfo.bandwidth_mb || userInfo.BANDWIDTH_MB) {
          bandwidthFieldName = userInfo.bandwidth_mb ? 'bandwidth_mb' : 'BANDWIDTH_MB';
          bandwidthValue = userInfo.bandwidth_mb || userInfo.BANDWIDTH_MB;
        } else if (userInfo.bandwidth || userInfo.BANDWIDTH) {
          bandwidthFieldName = userInfo.bandwidth ? 'bandwidth' : 'BANDWIDTH';
          bandwidthValue = userInfo.bandwidth || userInfo.BANDWIDTH;
        } else if (userInfo.bandwidth_limit || userInfo.BANDWIDTH_LIMIT) {
          bandwidthFieldName = userInfo.bandwidth_limit ? 'bandwidth_limit' : 'BANDWIDTH_LIMIT';
          bandwidthValue = userInfo.bandwidth_limit || userInfo.BANDWIDTH_LIMIT;
        } else if (usage.bandwidth_limit || usage.BANDWIDTH_LIMIT) {
          bandwidthFieldName = usage.bandwidth_limit ? 'bandwidth_limit' : 'BANDWIDTH_LIMIT';
          bandwidthValue = usage.bandwidth_limit || usage.BANDWIDTH_LIMIT;
        } else if (usage.bandwidth_gb || usage.BANDWIDTH_GB) {
          bandwidthFieldName = usage.bandwidth_gb ? 'bandwidth_gb' : 'BANDWIDTH_GB';
          bandwidthValue = usage.bandwidth_gb || usage.BANDWIDTH_GB;
        } else if (usage.bandwidth_mb || usage.BANDWIDTH_MB) {
          bandwidthFieldName = usage.bandwidth_mb ? 'bandwidth_mb' : 'BANDWIDTH_MB';
          bandwidthValue = usage.bandwidth_mb || usage.BANDWIDTH_MB;
        }
        
        // If bandwidth is still 0, use the fallback
        if (!bandwidthValue || bandwidthValue === 0) {
          bandwidthValue = bandwidth;
        }
        
        // Parse bandwidth usage with field name context
        bandwidthUsed = convertToMB(bandwidthUsedValue, bandwidthUsedFieldName);
        bandwidthLimit = convertToMB(bandwidthValue, bandwidthFieldName);
        
        syncLogger.log(`  ✓ Bandwidth USED: ${bandwidthUsedValue} from field "${bandwidthUsedFieldName}" → ${bandwidthUsed.toFixed(2)} MB`);
        syncLogger.log(`  ✓ Bandwidth LIMIT: ${bandwidthValue} from field "${bandwidthFieldName}" → ${bandwidthLimit.toFixed(2)} MB`);
        
        syncLogger.log(`  Quota field found: "${quotaFieldName}" = ${quotaValue} (type: ${typeof quotaValue})`);
        syncLogger.log(`  Quota used field found: "${quotaUsedFieldName}" = ${quotaUsedValue} (type: ${typeof quotaUsedValue})`);
        
        syncLogger.log(`  Parsed usage - Disk: ${diskUsed.toFixed(2)}MB / ${diskLimit.toFixed(2)}MB, Bandwidth: ${bandwidthUsed.toFixed(2)}MB / ${bandwidthLimit.toFixed(2)}MB`);
        
        // Comprehensive logging of all quota-related fields
        syncLogger.debug(`  ===== QUOTA DEBUG INFO =====`);
        syncLogger.debug(`  userInfo.quota: ${userInfo.quota} (${typeof userInfo.quota})`);
        syncLogger.debug(`  userInfo.QUOTA: ${userInfo.QUOTA} (${typeof userInfo.QUOTA})`);
        syncLogger.debug(`  userInfo.quota_mb: ${userInfo.quota_mb} (${typeof userInfo.quota_mb})`);
        syncLogger.debug(`  userInfo.quota_gb: ${userInfo.quota_gb} (${typeof userInfo.quota_gb})`);
        syncLogger.debug(`  usage.quota: ${usage.quota} (${typeof usage.quota})`);
        syncLogger.debug(`  usage.QUOTA: ${usage.QUOTA} (${typeof usage.QUOTA})`);
        syncLogger.debug(`  Final quota value: ${quota} (${typeof quota})`);
        syncLogger.debug(`  Final quotaUsed value: ${quotaUsed} (${typeof quotaUsed})`);
        syncLogger.debug(`  Parsed diskLimit: ${diskLimit} MB`);
        syncLogger.debug(`  Parsed diskUsed: ${diskUsed} MB`);
        syncLogger.debug(`  ============================`);
        
        // Comprehensive logging of bandwidth-related fields
        syncLogger.debug(`  ===== BANDWIDTH DEBUG INFO =====`);
        syncLogger.debug(`  userInfo.bandwidth: ${userInfo.bandwidth} (${typeof userInfo.bandwidth})`);
        syncLogger.debug(`  userInfo.BANDWIDTH: ${userInfo.BANDWIDTH} (${typeof userInfo.BANDWIDTH})`);
        syncLogger.debug(`  userInfo.bandwidth_mb: ${userInfo.bandwidth_mb} (${typeof userInfo.bandwidth_mb})`);
        syncLogger.debug(`  userInfo.bandwidth_gb: ${userInfo.bandwidth_gb} (${typeof userInfo.bandwidth_gb})`);
        syncLogger.debug(`  usage.bandwidth: ${usage.bandwidth} (${typeof usage.bandwidth})`);
        syncLogger.debug(`  usage.BANDWIDTH: ${usage.BANDWIDTH} (${typeof usage.BANDWIDTH})`);
        syncLogger.debug(`  usage.bandwidth_used: ${usage.bandwidth_used} (${typeof usage.bandwidth_used})`);
        syncLogger.debug(`  Final bandwidth value: ${bandwidth} (${typeof bandwidth})`);
        syncLogger.debug(`  Final bandwidthUsedVal: ${bandwidthUsedVal} (${typeof bandwidthUsedVal})`);
        syncLogger.debug(`  Parsed bandwidthLimit: ${bandwidthLimit} MB`);
        syncLogger.debug(`  Parsed bandwidthUsed: ${bandwidthUsed} MB`);
        syncLogger.debug(`  ===============================`);
        
        // If diskLimit is still 0, try to find it in ALL possible fields
        if (diskLimit === 0) {
          syncLogger.warn(`  ⚠️  diskLimit is 0! Searching all fields...`);
          const allKeys = Object.keys(allData);
          const quotaLikeKeys = allKeys.filter(k => 
            k.toLowerCase().includes('quota') || 
            k.toLowerCase().includes('limit') ||
            k.toLowerCase().includes('disk') ||
            k.toLowerCase().includes('size')
          );
          syncLogger.warn(`  Found quota-like keys:`, quotaLikeKeys);
          for (const key of quotaLikeKeys) {
            const val = allData[key];
            syncLogger.warn(`    ${key} = ${val} (${typeof val})`);
            // Try to parse it
            if (val && val !== 'unlimited' && val !== 'UNLIMITED' && val !== '0' && val !== 0) {
              const parsed = convertToMB(val, key);
              if (parsed > 0) {
                syncLogger.warn(`    ✓ Parsed ${key} as ${parsed} MB - using this!`);
                diskLimit = parsed;
                quotaFieldName = key;
                break;
              }
            }
          }
        }
        
        // If diskUsed is still 0 but we have quota_used, try harder
        if (diskUsed === 0 && quotaUsed && quotaUsed !== 0) {
          syncLogger.warn(`  ⚠️  diskUsed is 0 but quotaUsed exists: ${quotaUsed}`);
          diskUsed = convertToMB(quotaUsed, quotaUsedFieldName);
          syncLogger.warn(`  Retried parsing diskUsed: ${diskUsed} MB`);
        }
        
        const accountData = {
          domain: domain,
          username: username,
          package_name: userInfo.package || userInfo.PACKAGE || userInfo.package_name || 'default',
          status: (userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes' || userInfo.suspended === true) ? 'suspended' : 'active',
          disk_used: diskUsed,
          disk_limit: diskLimit,
          bandwidth_used: bandwidthUsed,
          bandwidth_limit: bandwidthLimit,
          ip_address: userInfo.ip || userInfo.IP || userInfo.ip_address || null,
          cpanel_url: domain ? `https://${domain}:2222` : null, // DirectAdmin port
          whm_account_id: null,
          suspended_at: (userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes' || userInfo.suspended === true) ? new Date() : null,
        };
        
        syncLogger.debug(`  Account data prepared:`, accountData);
        
        if (existing.length > 0) {
          syncLogger.log(`  Updating existing account (ID: ${existing[0].id})`);
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
          syncLogger.log(`  ✅ Updated account: ${username}`);
        } else {
          syncLogger.log(`  Creating new account`);
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
          syncLogger.log(`  ✅ Created account: ${username}`);
        }
        synced++;
      } catch (err) {
        syncLogger.error(`  ❌ Error syncing account ${username}:`, err.message);
        syncLogger.error(`  Error stack:`, err.stack);
      }
    }
    
    syncLogger.log('========================================');
    syncLogger.log(`Sync completed!`);
    syncLogger.log(`Total: ${synced}, Created: ${created}, Updated: ${updated}`);
    syncLogger.log('========================================');
    
    res.json({
      success: true,
      message: `Synced ${synced} accounts (${created} created, ${updated} updated)`,
      created,
      updated,
      synced,
    });
  } catch (error) {
    syncLogger.error('========================================');
    syncLogger.error('❌ Fatal error syncing accounts:', error.message);
    syncLogger.error('Error stack:', error.stack);
    syncLogger.error('========================================');
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
    defaultLogger.error('Error creating hosting account:', error);
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
    defaultLogger.error('Error suspending account:', error);
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
    defaultLogger.error('Error unsuspending account:', error);
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
    defaultLogger.error('Error terminating account:', error);
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
    defaultLogger.error('Error updating account:', error);
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
    defaultLogger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

