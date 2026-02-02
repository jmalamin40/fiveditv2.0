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
    
    console.log(`[DirectAdmin] Making ${method} request to ${hostname}:${port}`);
    console.log(`[DirectAdmin] Command: ${command}`);
    console.log(`[DirectAdmin] Using ${trySSL ? 'HTTPS' : 'HTTP'}`);
    if (Object.keys(params).length > 0) {
      console.log(`[DirectAdmin] Params:`, JSON.stringify(params, null, 2));
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
        
        console.log(`[DirectAdmin] Response status: ${res.statusCode}`);
        console.log(`[DirectAdmin] Response headers:`, JSON.stringify(res.headers, null, 2));
        
        // Check if response is valid HTTP
        if (res.statusCode === undefined) {
          return reject(new Error('Invalid HTTP response from server. Check host and port.'));
        }
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(`[DirectAdmin] Raw response length: ${data.length} bytes`);
            console.log(`[DirectAdmin] Raw response (first 500 chars):`, data.substring(0, 500));
            
            // Check for HTTP error status
            if (res.statusCode >= 400) {
              console.error(`[DirectAdmin] HTTP Error ${res.statusCode}:`, data.substring(0, 500));
              return reject(new Error(`DirectAdmin API returned status ${res.statusCode}: ${data.substring(0, 200)}`));
            }
            
            // DirectAdmin can return JSON or key=value format
            if (data.trim().startsWith('{')) {
              const json = JSON.parse(data);
              console.log(`[DirectAdmin] Parsed JSON response:`, JSON.stringify(json, null, 2));
              if (json.error) {
                console.error(`[DirectAdmin] JSON error:`, json.error);
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
                console.log(`[DirectAdmin] Detected single-line URL-encoded format`);
                try {
                  // Parse as URL-encoded query string
                  const urlParams = new URLSearchParams(data);
                  for (const [key, value] of urlParams.entries()) {
                    // Try to parse as number or boolean
                    let parsedValue = value;
                    if (value === 'yes') parsedValue = true;
                    else if (value === 'no') parsedValue = false;
                    else if (!isNaN(value) && value !== '') parsedValue = parseFloat(value);
                    result[key] = parsedValue;
                  }
                  console.log(`[DirectAdmin] Parsed ${Object.keys(result).length} key-value pairs from URL-encoded format`);
                } catch (urlErr) {
                  console.warn(`[DirectAdmin] Failed to parse as URLSearchParams, trying manual parsing:`, urlErr.message);
                  // Fallback: manual parsing
                  const parts = data.split('&');
                  for (const part of parts) {
                    const [key, ...valueParts] = part.split('=');
                    if (key && valueParts.length > 0) {
                      let value = decodeURIComponent(valueParts.join('='));
                      // Try to parse as number or boolean
                      if (value === 'yes') value = true;
                      else if (value === 'no') value = false;
                      else if (!isNaN(value) && value !== '') value = parseFloat(value);
                      result[key] = value;
                    }
                  }
                }
              } else {
                // Parse multi-line key=value format
                const lines = data.split('\n');
                console.log(`[DirectAdmin] Parsing key=value format, ${lines.length} lines`);
                
                // Also check if data contains URL-encoded format (list[]=user1&list[]=user2)
                // Or mixed format (user1&list[]=user2&list[]=user3)
                if (data.includes('list[]=') || data.includes('list%5B%5D=') || data.includes('&list')) {
                console.log(`[DirectAdmin] Detected URL-encoded list format, parsing...`);
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
                        console.log(`[DirectAdmin] Extracted username from list[]: ${username}`);
                      }
                    } else if (!trimmed.includes('=') && !trimmed.includes('%') && trimmed.length > 0) {
                      // It's a plain username (first one in mixed format like: user1&list[]=user2)
                      // Make sure it's not part of a key=value pair
                      if (!trimmed.match(/^[a-zA-Z0-9_\-\.]+$/)) {
                        // Skip if it contains invalid characters for a username
                        continue;
                      }
                      users.push(trimmed);
                      console.log(`[DirectAdmin] Extracted plain username: ${trimmed}`);
                    }
                  }
                  
                  if (users.length > 0) {
                    console.log(`[DirectAdmin] Found ${users.length} users in URL-encoded format:`, users);
                    result.list = users;
                    // Also add them as list[0], list[1], etc. for compatibility
                    users.forEach((user, index) => {
                      result[`list[${index}]`] = user;
                    });
                  }
                } catch (urlErr) {
                  console.warn(`[DirectAdmin] Failed to parse URL-encoded format:`, urlErr.message);
                  console.warn(`[DirectAdmin] Error stack:`, urlErr.stack);
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
              
              console.log(`[DirectAdmin] Parsed ${Object.keys(result).length} key-value pairs`);
              console.log(`[DirectAdmin] Parsed result:`, JSON.stringify(result, null, 2));
              resolve(result);
            }
          } catch (error) {
            console.error(`[DirectAdmin] Parse error:`, error.message);
            console.error(`[DirectAdmin] Raw data:`, data.substring(0, 1000));
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
        console.error(`[DirectAdmin] Request error:`, error.message);
        console.error(`[DirectAdmin] Error code:`, error.code);
        // If SSL error and we tried SSL, retry with HTTP
        if (useSSL && (error.code === 'ECONNRESET' || error.message.includes('wrong version number') || error.message.includes('SSL') || error.message.includes('Parse Error'))) {
          console.log(`[DirectAdmin] SSL connection failed (${error.message}), retrying with HTTP for ${hostname}:${port}`);
          makeRequest(false);
        } else {
          console.error(`[DirectAdmin] Request failed permanently:`, error);
          reject(new Error(`DirectAdmin request failed: ${error.message}. Check if DirectAdmin is running on ${hostname}:${port} and the credentials are correct.`));
        }
      });
      
      // Set timeout to prevent hanging
      request.setTimeout(10000, () => {
        console.error(`[DirectAdmin] Request timeout after 10 seconds`);
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
  console.log('========================================');
  console.log('[SYNC] Starting DirectAdmin account sync');
  console.log('========================================');
  
  try {
    const config = await getDirectAdminConfig();
    if (!config) {
      console.error('[SYNC] No hosting configuration found');
      return res.status(400).json({ error: 'No hosting configuration found. Please configure DirectAdmin first.' });
    }
    
    console.log('[SYNC] Configuration loaded:');
    console.log(`  - Host: ${config.whm_host}`);
    console.log(`  - Port: ${config.whm_port || 2222}`);
    console.log(`  - SSL: ${config.whm_ssl !== false}`);
    console.log(`  - Username: ${config.whm_username}`);
    console.log(`  - Reseller: ${config.reseller_username || 'N/A'}`);
    
    // Get list of users from DirectAdmin
    console.log('[SYNC] Fetching users list from DirectAdmin...');
    const usersResult = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USERS', {});
    
    console.log('[SYNC] Raw DirectAdmin response type:', typeof usersResult);
    console.log('[SYNC] Raw DirectAdmin response:', JSON.stringify(usersResult, null, 2));
    console.log('[SYNC] Response keys:', Object.keys(usersResult || {}));
    
    let synced = 0;
    let created = 0;
    let updated = 0;
    
    // Parse users list - DirectAdmin returns in format: list[0]=user1, list[1]=user2, etc.
    let users = [];
    
    console.log('[SYNC] Parsing users list...');
    
    if (Array.isArray(usersResult)) {
      console.log('[SYNC] Response is an array');
      users = usersResult;
    } else if (usersResult.users && Array.isArray(usersResult.users)) {
      console.log('[SYNC] Response has users array property');
      users = usersResult.users;
    } else if (typeof usersResult === 'object' && usersResult !== null) {
      console.log('[SYNC] Response is an object, parsing...');
      console.log('[SYNC] Full response:', JSON.stringify(usersResult, null, 2));
      
      // Check if response contains username field(s) - DirectAdmin might return user data directly
      // Format could be: { username: 'user1', domain: '...', ... } or multiple users
      if (usersResult.username && typeof usersResult.username === 'string') {
        // Single user object with username field
        console.log('[SYNC] Found single user object with username:', usersResult.username);
        users = [usersResult.username];
      } else {
        // First, check if there's a 'list' array (from URL-encoded parsing)
        if (Array.isArray(usersResult.list)) {
          console.log('[SYNC] Found list array property with', usersResult.list.length, 'users');
          users = usersResult.list.filter(Boolean);
          console.log(`[SYNC] Extracted ${users.length} users from list array`);
        } else {
        // Parse DirectAdmin's list format: list[0]=username1, list[1]=username2, etc.
        const listKeys = Object.keys(usersResult).filter(k => {
          const lowerKey = k.toLowerCase();
          return lowerKey.startsWith('list[') || lowerKey.startsWith('user[') || lowerKey.startsWith('username[');
        });
        
        console.log(`[SYNC] Found ${listKeys.length} list keys:`, listKeys);
        
        if (listKeys.length > 0) {
          // Extract usernames from list[0], list[1], etc.
          users = listKeys
            .sort((a, b) => {
              const numA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
              const numB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
              return numA - numB;
            })
            .map(key => {
              const value = usersResult[key];
              console.log(`[SYNC]   ${key} = ${value}`);
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
                console.warn(`[SYNC]   ⚠️  Skipping invalid username (contains URL encoding): ${u}`);
                return false;
              }
              return true;
            });
          console.log(`[SYNC] Extracted ${users.length} users from list keys`);
        } else {
        console.log('[SYNC] No list keys found, trying alternative parsing...');
        console.log('[SYNC] All response keys:', Object.keys(usersResult));
        
        // Try to extract usernames from other keys (excluding error, etc.)
        const excludedKeys = ['error', 'ERROR', 'list', 'LIST', 'success', 'SUCCESS', 'text', 'TEXT', 'account', 'domain', 'package', 'ip', 'email', 'quota', 'bandwidth'];
        const candidateKeys = Object.keys(usersResult).filter(k => {
          const upperKey = k.toUpperCase();
          return !excludedKeys.some(ex => upperKey.includes(ex));
        });
        
        console.log(`[SYNC] Candidate keys (${candidateKeys.length}):`, candidateKeys);
        
        // Check if 'username' key exists (common in DirectAdmin responses)
        if (usersResult.username) {
          const usernameValue = usersResult.username;
          if (typeof usernameValue === 'string' && usernameValue.length > 0) {
            users.push(usernameValue);
            console.log(`[SYNC] Found username field: ${usernameValue}`);
          } else if (Array.isArray(usernameValue)) {
            users.push(...usernameValue.filter(u => typeof u === 'string' && u.length > 0));
            console.log(`[SYNC] Found username array with ${users.length} users`);
          }
        }
        
        // Also check other candidate keys
        const additionalUsers = candidateKeys
          .map(key => {
            const value = usersResult[key];
            console.log(`[SYNC]   Checking key "${key}": value="${value}" (type: ${typeof value})`);
            
            // If value looks like a username (not a number, not yes/no, not empty, not a common config key)
            if (typeof value === 'string' && value.length > 0 && value !== 'yes' && value !== 'no' && isNaN(value) && !value.includes('=') && !value.includes('&') && !value.includes('%')) {
              // Additional validation: username should be alphanumeric with possible underscores/dots
              if (value.match(/^[a-zA-Z0-9_\-\.]+$/) && value.length >= 3 && value.length <= 32) {
                console.log(`[SYNC]     ✓ Valid username: ${value}`);
                return value;
              }
            }
            return null;
          })
          .filter(Boolean);
        
        // Merge and deduplicate
        users = [...new Set([...users, ...additionalUsers])];
        console.log(`[SYNC] Extracted ${users.length} unique users from candidate keys`);
        }
      }
      }
    } else {
      console.error('[SYNC] Unexpected response type:', typeof usersResult);
    }
    
    console.log(`[SYNC] Total users found: ${users.length}`);
    console.log(`[SYNC] Users list:`, users);
    
    if (users.length === 0) {
      console.warn('[SYNC] No users found to sync!');
      console.warn('[SYNC] This might indicate:');
      console.warn('  1. No accounts exist in DirectAdmin');
      console.warn('  2. The API response format is different than expected');
      console.warn('  3. The user does not have permission to list users');
      console.warn('  4. The API command returned an error');
      
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
    
    console.log('[SYNC] Processing users...');
    
    for (let i = 0; i < users.length; i++) {
      const username = users[i];
      console.log(`[SYNC] [${i + 1}/${users.length}] Processing user: ${username}`);
      
      try {
        if (!username || typeof username !== 'string') {
          console.warn(`[SYNC]   ⚠️  Skipping invalid username:`, username);
          continue;
        }
        
        // Get user details
        console.log(`[SYNC]   Fetching user config for: ${username}`);
        const userInfo = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_CONFIG', { user: username });
        console.log(`[SYNC]   User config received:`, JSON.stringify(userInfo, null, 2));
        
        if (userInfo.error || userInfo.ERROR) {
          console.error(`[SYNC]   ❌ Error getting user info for ${username}:`, userInfo.error || userInfo.ERROR);
          continue;
        }
        
        const domain = userInfo.domain || userInfo.DOMAIN || userInfo.name || null;
        console.log(`[SYNC]   Domain for ${username}: ${domain}`);
        
        if (!domain) {
          console.warn(`[SYNC]   ⚠️  No domain found for user ${username}, skipping`);
          console.warn(`[SYNC]   Available keys:`, Object.keys(userInfo));
          continue;
        }
        
        // Check if account already exists
        const [existing] = await pool.execute(
          'SELECT id FROM hosting_accounts WHERE username = ? OR domain = ?',
          [username, domain]
        );
        console.log(`[SYNC]   Existing account check: ${existing.length > 0 ? 'Found' : 'New'}`);
        
        // Get usage stats
        console.log(`[SYNC]   Fetching usage stats for: ${username}`);
        let usage = {};
        try {
          usage = await makeDirectAdminRequest(config, 'CMD_API_SHOW_USER_USAGE', { user: username });
          console.log(`[SYNC]   Usage stats:`, JSON.stringify(usage, null, 2));
        } catch (usageErr) {
          console.warn(`[SYNC]   ⚠️  Could not fetch usage stats:`, usageErr.message);
        }
        
        const accountData = {
          domain: domain,
          username: username,
          package_name: userInfo.package || userInfo.PACKAGE || userInfo.package_name || 'default',
          status: (userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes' || userInfo.suspended === true) ? 'suspended' : 'active',
          disk_used: parseFloat(usage.quota_used || usage.QUOTA_USED || usage.quota_used_mb || 0) / 1024 / 1024 || 0, // Convert bytes to MB if needed
          disk_limit: parseFloat(usage.quota || usage.QUOTA || usage.quota_mb || 0) / 1024 / 1024 || 0,
          bandwidth_used: parseFloat(usage.bandwidth_used || usage.BANDWIDTH_USED || usage.bandwidth_used_mb || 0) / 1024 / 1024 || 0,
          bandwidth_limit: parseFloat(usage.bandwidth || usage.BANDWIDTH || usage.bandwidth_mb || 0) / 1024 / 1024 || 0,
          ip_address: userInfo.ip || userInfo.IP || userInfo.ip_address || null,
          cpanel_url: domain ? `https://${domain}:2222` : null, // DirectAdmin port
          whm_account_id: null,
          suspended_at: (userInfo.suspended === 'yes' || userInfo.SUSPENDED === 'yes' || userInfo.suspended === true) ? new Date() : null,
        };
        
        console.log(`[SYNC]   Account data prepared:`, JSON.stringify(accountData, null, 2));
        
        if (existing.length > 0) {
          console.log(`[SYNC]   Updating existing account (ID: ${existing[0].id})`);
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
          console.log(`[SYNC]   ✅ Updated account: ${username}`);
        } else {
          console.log(`[SYNC]   Creating new account`);
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
          console.log(`[SYNC]   ✅ Created account: ${username}`);
        }
        synced++;
      } catch (err) {
        console.error(`[SYNC]   ❌ Error syncing account ${username}:`, err.message);
        console.error(`[SYNC]   Error stack:`, err.stack);
      }
    }
    
    console.log('========================================');
    console.log(`[SYNC] Sync completed!`);
    console.log(`[SYNC] Total: ${synced}, Created: ${created}, Updated: ${updated}`);
    console.log('========================================');
    
    res.json({
      success: true,
      message: `Synced ${synced} accounts (${created} created, ${updated} updated)`,
      created,
      updated,
      synced,
    });
  } catch (error) {
    console.error('========================================');
    console.error('[SYNC] ❌ Fatal error syncing accounts:', error.message);
    console.error('[SYNC] Error stack:', error.stack);
    console.error('========================================');
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

