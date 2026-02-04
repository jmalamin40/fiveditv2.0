const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { defaultLogger, syncLogger } = require('../utils/logger');
const { sendHostingCredentialsEmail, sendOrderConfirmationEmail } = require('../utils/email');
const { generateInvoiceForOrder } = require('./invoices');

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api-pay.fivedit.com';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'your-api-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fivedit.com';

// Helper function to get DirectAdmin config and make requests
async function getDirectAdminConfig() {
  const [configs] = await pool.execute(
    'SELECT * FROM hosting_config WHERE is_active = TRUE LIMIT 1'
  );
  return configs.length > 0 ? configs[0] : null;
}

// Helper function to decrypt password
function decryptPassword(encryptedPassword) {
  const algorithm = 'aes-256-cbc';
  const envKey = process.env.ENCRYPTION_KEY;
  const key = envKey && envKey.length >= 32 
    ? Buffer.from(envKey.substring(0, 32), 'utf8')
    : Buffer.from('default-encryption-key-32-chars!!', 'utf8');
  const iv = Buffer.from(encryptedPassword.substring(0, 32), 'hex');
  const encrypted = encryptedPassword.substring(32);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to make DirectAdmin request
function makeDirectAdminRequest(config, command, params = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const password = decryptPassword(config.whm_password_encrypted);
    const auth = Buffer.from(`${config.whm_username}:${password}`).toString('base64');
    const port = config.whm_port || 2222;
    const hostname = config.whm_host;
    const trySSL = config.whm_ssl !== false;
    
    defaultLogger.log(`Making ${method} request to ${hostname}:${port}`);
    defaultLogger.log(`Command: ${command}`);
    defaultLogger.log(`Using ${trySSL ? 'HTTPS' : 'HTTP'}`);
    if (Object.keys(params).length > 0) {
      defaultLogger.debug(`Params:`, params);
    }
    
    const makeRequest = (useSSL) => {
      const httpModule = useSSL ? require('https') : require('http');
      let url, options;
      let formData; // Declare formData in function scope
      
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
        formData = new URLSearchParams(params);
        
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
      
      const req = httpModule.request(options, (res) => {
        let data = '';
        
        defaultLogger.log(`Response status: ${res.statusCode}`);
        defaultLogger.log(`Response response:`, JSON.stringify(res?.response, null, 2));
        defaultLogger.log(`Response data:`, JSON.stringify(res?.data, null, 2));
        defaultLogger.log(`Response text:`, res?.text);
        defaultLogger.log(`Response json:`, JSON.stringify(res?.json, null, 2));
        defaultLogger.log(`Response headers:`, JSON.stringify(res?.headers, null, 2));
        defaultLogger.log(`Response statusCode:`, res?.statusCode);
        defaultLogger.log(`Response statusMessage:`, res?.statusMessage);
        defaultLogger.log(`Response rawHeaders:`, JSON.stringify(res?.rawHeaders, null, 2));
        defaultLogger.log(`Response rawTrailers:`, JSON.stringify(res?.rawTrailers, null, 2));
        // defaultLogger.debug(`Response headers:`, res.headers);
        
        // Check if response is valid HTTP
        if (res.statusCode === undefined) {
          return reject(new Error('Invalid HTTP response from server. Check host and port.'));
        }
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            defaultLogger.debug(`Raw response length: ${data.length} bytes`);
            defaultLogger.debug(`Raw response (first 500 chars):`, data.substring(0, 500));
            
            // Check for HTTP error status
            if (res.statusCode >= 400) {
              defaultLogger.error(`HTTP Error ${res.statusCode}:`, data.substring(0, 500));
              return reject(new Error(`DirectAdmin API returned status ${res.statusCode}: ${data.substring(0, 200)}`));
            }
            
            // DirectAdmin can return JSON or key=value format
            // Sometimes the response is a JSON string containing URL-encoded data
            let actualData = data;
            
            // Check if data is a JSON string (wrapped in quotes)
            if (data.trim().startsWith('"') && data.trim().endsWith('"')) {
              try {
                // Parse JSON string to get the actual data
                actualData = JSON.parse(data);
                defaultLogger.log(`Data was JSON-encoded, extracted: ${actualData.substring(0, 100)}...`);
                // If the extracted data is still a string with URL-encoded format, we need to parse it
                if (typeof actualData === 'string' && actualData.includes('&') && actualData.includes('=')) {
                  // The data is URL-encoded, we'll parse it below
                  defaultLogger.log(`Extracted data is URL-encoded format`);
                }
              } catch (jsonErr) {
                // Not valid JSON, use data as-is
                defaultLogger.debug(`Failed to parse as JSON string, using data as-is`);
              }
            }
            
            if (actualData.trim().startsWith('{')) {
              // Try to parse as JSON object
              try {
                const json = JSON.parse(actualData);
                defaultLogger.debug(`Parsed JSON response:`, json);
                if (json.error && json.error !== 0 && json.error !== '0') {
                  defaultLogger.error(`JSON error:`, json.error);
                  reject(new Error(json.error || 'DirectAdmin API error'));
                } else {
                  resolve(json);
                }
                return;
              } catch (jsonErr) {
                defaultLogger.debug(`Not valid JSON object, trying URL-encoded format`);
              }
            }
            
            // Parse key=value format (URL-encoded or newline-separated)
            const result = {};
            defaultLogger.log(`Parsing DirectAdmin response data (length: ${actualData.length})`);
            defaultLogger.log(`Actual data preview: ${actualData.substring(0, 200)}`);
            
            // Check if data is in single-line URL-encoded format (key=value&key=value&...)
            // This is common in DirectAdmin responses
            // Also check if it's a string that contains URL-encoded format
            const isUrlEncodedFormat = typeof actualData === 'string' && actualData.includes('&') && actualData.includes('=');
            const isSingleLineUrlEncoded = isUrlEncodedFormat && !actualData.includes('\n');
              
              if (isSingleLineUrlEncoded || (isUrlEncodedFormat && actualData.split('&').length >= 2)) {
                defaultLogger.log(`Detected URL-encoded format (single-line: ${isSingleLineUrlEncoded})`);
                try {
                  // Parse as URL-encoded query string
                  // URLSearchParams automatically handles URL decoding
                  const urlParams = new URLSearchParams(actualData);
                  
                  // First, check if there are list[] entries (for CMD_API_SHOW_USERS)
                  const listValues = urlParams.getAll('list[]');
                  if (listValues.length > 0) {
                    defaultLogger.log(`Found ${listValues.length} users in list[] format`);
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
                    else if (!isNaN(value) && value.trim() !== '') {
                      const numValue = parseFloat(value);
                      // Only parse as number if it's actually a number (not NaN)
                      if (!isNaN(numValue)) parsedValue = numValue;
                    }
                    result[key] = parsedValue;
                    defaultLogger.debug(`Parsed key-value: ${key} = ${typeof parsedValue === 'string' ? parsedValue.substring(0, 50) : parsedValue}`);
                  }
                  defaultLogger.log(`Parsed ${Object.keys(result).length} key-value pairs from URL-encoded format`);
                  defaultLogger.log(`Result keys: ${Object.keys(result).join(', ')}`);
                  
                  // Check if URLSearchParams parsed correctly - if we only have one key and its value contains '&', it failed
                  const resultKeys = Object.keys(result);
                  if (resultKeys.length === 1 && typeof result[resultKeys[0]] === 'string' && result[resultKeys[0]].includes('&')) {
                    defaultLogger.warn(`URLSearchParams didn't parse correctly (single key with '&' in value), using manual parsing`);
                    // Clear result and use manual parsing
                    Object.keys(result).forEach(key => delete result[key]);
                    throw new Error('URLSearchParams parsing failed, using manual parsing');
                  }
                } catch (urlErr) {
                  defaultLogger.warn(`Failed to parse as URLSearchParams: ${urlErr.message}`);
                  defaultLogger.warn(`Trying manual parsing...`);
                  // Fallback: manual parsing
                  const parts = actualData.split('&');
                  defaultLogger.log(`Manual parsing: split into ${parts.length} parts`);
                  const listUsers = [];
                  
                  for (const part of parts) {
                    if (!part || !part.includes('=')) {
                      defaultLogger.debug(`Skipping invalid part: ${part.substring(0, 50)}`);
                      continue;
                    }
                    
                    const equalIndex = part.indexOf('=');
                    const key = part.substring(0, equalIndex).trim();
                    const valueStr = part.substring(equalIndex + 1);
                    
                    if (key && valueStr) {
                      let value = decodeURIComponent(valueStr);
                      
                      // Check if it's a list[] entry
                      if (key === 'list[]' || key.toLowerCase() === 'list%5b%5d') {
                        listUsers.push(value);
                        continue;
                      }
                      
                      // Try to parse as number or boolean
                      if (value === 'yes') value = true;
                      else if (value === 'no') value = false;
                      else if (!isNaN(value) && value.trim() !== '') {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) value = numValue;
                      }
                      
                      result[key] = value;
                      defaultLogger.debug(`Parsed: ${key} = ${typeof value === 'string' ? value.substring(0, 50) : value}`);
                    }
                  }
                  
                  if (listUsers.length > 0) {
                    defaultLogger.log(`Found ${listUsers.length} users in manual parsing`);
                    result.list = listUsers;
                    listUsers.forEach((user, index) => {
                      result[`list[${index}]`] = user;
                    });
                  }
                  
                  defaultLogger.log(`Manual parsing complete: ${Object.keys(result).length} keys`);
                }
              } else {
                // Parse newline-separated key=value format
                const pairs = actualData.split('\n').filter(line => line.includes('='));
                pairs.forEach(pair => {
                  const [key, ...valueParts] = pair.split('=');
                  if (key && valueParts.length > 0) {
                    let value = decodeURIComponent(valueParts.join('=').trim());
                    
                    // Try to parse as number or boolean
                    if (value === 'yes') value = true;
                    else if (value === 'no') value = false;
                    else if (!isNaN(value) && value !== '') value = parseFloat(value);
                    
                    result[key.trim()] = value;
                  }
                });
              }
              defaultLogger.log(`Result:`, JSON.stringify(result, null, 2));
              // Check for error in parsed result
              // DirectAdmin: error=0 means success, error=1 (or any non-zero) means failure
              const errorValue = result.error;
              if (errorValue !== undefined && errorValue !== null && errorValue !== 0 && errorValue !== '0') {
                defaultLogger.error(`Error in response:`, errorValue);
                // If there's a text field with error message, use it
                const errorMessage = result.text || result.details || errorValue;
                reject(new Error(String(errorMessage) || 'DirectAdmin API error'));
              } else if (result.text === 'error' || (result.text && typeof result.text === 'string' && result.text.toLowerCase().includes('error') && !result.text.toLowerCase().includes('successfully'))) {
                defaultLogger.error(`Error text in response:`, result.text);
                reject(new Error(result.text || 'DirectAdmin API error'));
              } else {
                // Success! DirectAdmin returns error=0 for success
                defaultLogger.log(`✅ DirectAdmin response parsed successfully`);
                defaultLogger.log(`   Parsed ${Object.keys(result).length} key-value pairs`);
                if (result.text) {
                  defaultLogger.log(`   Response text: ${result.text.substring(0, 100)}`);
                }
                resolve(result);
              }
          } catch (error) {
            defaultLogger.error(`Error parsing DirectAdmin response:`, error);
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        defaultLogger.error(`Request error:`, error);
        if (useSSL && trySSL) {
          // Retry with HTTP if SSL fails
          defaultLogger.log(`Retrying with HTTP...`);
          makeRequest(false);
        } else {
          reject(error);
        }
      });
      
      if (method === 'POST') {
        req.write(formData.toString());
      }
      req.end();
    };
    
    makeRequest(trySSL);
  });
}

// Generate secure random password
function generatePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, x => charset[x % charset.length]).join('');
}

// Optional customer authentication middleware (doesn't fail if token is missing)
function optionalCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      if (process.env.JWT_SECRET) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role === 'customer') {
          req.customer = payload;
        }
      }
    } catch (error) {
      // Token invalid or expired, but continue without customer auth
      defaultLogger.debug('Optional customer auth failed:', error.message);
    }
  }
  next();
}

// Create payment order for hosting
router.post('/orders', optionalCustomerAuth, async (req, res) => {
  try {
    const {
      package_id,
      billing_period,
      customer_name,
      customer_email,
      customer_phone,
      domain,
      username,
    } = req.body;

    if (!package_id || !billing_period || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get customer_id if customer is authenticated
    let customer_id = null;
    if (req.customer && req.customer.id) {
      customer_id = req.customer.id;
      // Verify customer exists and email matches
      const [customers] = await pool.execute(
        'SELECT id, email FROM customer_users WHERE id = ? AND email = ?',
        [customer_id, customer_email]
      );
      if (customers.length > 0) {
        defaultLogger.log(`Order linked to customer account: ${customer_id} (${customer_email})`);
      } else {
        // Email doesn't match, don't link to this customer account
        defaultLogger.warn(`Customer ID ${customer_id} email mismatch, not linking order`);
        customer_id = null;
      }
    }

    // Get package details
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ? AND is_active = TRUE',
      [package_id]
    );

    if (packages.length === 0) {
      return res.status(404).json({ error: 'Hosting package not found' });
    }

    const packageData = packages[0];
    const amount = billing_period === 'yearly' ? packageData.price_yearly : packageData.price_monthly;

    // Generate unique order ID
    const orderId = `HOST-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create order in database
    // Check if customer_id column exists, if not, insert without it
    let orderResult;
    try {
      // Try with customer_id first
      [orderResult] = await pool.execute(
        `INSERT INTO hosting_orders (
          order_id, package_id, package_name, billing_period, amount, currency,
          customer_name, customer_email, customer_phone, domain, username,
          return_url, cancel_url, status, customer_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderId,
          package_id,
          packageData.display_name,
          billing_period,
          amount,
          packageData.currency,
          customer_name,
          customer_email,
          customer_phone || null,
          domain || null,
          username || null,
          `${FRONTEND_URL}/hosting/payment/success`,
          `${FRONTEND_URL}/hosting/payment/cancel`,
          customer_id,
        ]
      );
    } catch (dbError) {
      // If customer_id column doesn't exist, insert without it
      if (dbError.code === 'ER_BAD_FIELD_ERROR' && dbError.message?.includes('customer_id')) {
        defaultLogger.warn('customer_id column not found, inserting order without customer_id. Please run migration.');
        [orderResult] = await pool.execute(
          `INSERT INTO hosting_orders (
            order_id, package_id, package_name, billing_period, amount, currency,
            customer_name, customer_email, customer_phone, domain, username,
            return_url, cancel_url, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            orderId,
            package_id,
            packageData.display_name,
            billing_period,
            amount,
            packageData.currency,
            customer_name,
            customer_email,
            customer_phone || null,
            domain || null,
            username || null,
            `${FRONTEND_URL}/hosting/payment/success`,
            `${FRONTEND_URL}/hosting/payment/cancel`,
          ]
        );
      } else {
        // Re-throw if it's a different error
        throw dbError;
      }
    }
    syncLogger.info('Hosting order created:', orderResult);
    defaultLogger.log(`Order created with ID: ${orderResult.insertId}, customer_id: ${customer_id || 'null'}`);
    
    // Validate and construct URLs
    const validateUrl = (url) => {
      try {
        const urlObj = new URL(url);
        // Check if URL is localhost (payment gateway may not accept this)
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          defaultLogger.warn(`⚠️  Using localhost URL: ${url}`);
          defaultLogger.warn('   Payment gateway may reject localhost URLs. Consider using ngrok or a public domain.');
        }
        return urlObj.toString();
      } catch (error) {
        defaultLogger.error('Invalid URL format:', url, error);
        throw new Error(`Invalid URL format: ${url}`);
      }
    };

    // Construct URLs with proper encoding
    const returnUrl = validateUrl(`${FRONTEND_URL}/hosting/payment/success?order_id=${encodeURIComponent(orderId)}`);
    const cancelUrl = validateUrl(`${FRONTEND_URL}/hosting/payment/cancel?order_id=${encodeURIComponent(orderId)}`);
    const webhookUrl = validateUrl(`${process.env.API_BASE_URL || 'http://localhost:3001'}/api/hosting/payments/webhook`);

    // Create payment order with payment gateway
    const paymentGatewayData = {
      order_id: orderResult.insertId, // Use database ID as order_id for payment gateway
      amount: Number(amount)?.toFixed(2) || 0,
      currency: packageData.currency,
      customer_name,
      customer_email,
      customer_phone: customer_phone || '',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      api_key: PAYMENT_API_KEY,
      webhook_url: webhookUrl,
    };
    syncLogger.info('Payment gateway data:', paymentGatewayData);
    try {
      const paymentResponse = await axios.post(
        `${PAYMENT_GATEWAY_URL}/orders`,
        paymentGatewayData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const transactionId = paymentResponse.data.transaction_id;
      const paymentUrl = paymentResponse.data.payment_url;
      syncLogger.info('Payment response:', paymentResponse.data);
      // Update order with transaction ID and payment URL
      await pool.execute(
        'UPDATE hosting_orders SET transaction_id = ?, payment_url = ?, payment_gateway_response = ? WHERE id = ?',
        [
          transactionId,
          paymentUrl,
          JSON.stringify(paymentResponse.data),
          orderResult.insertId,
        ]
      );
      syncLogger.info('Order updated:', orderResult.insertId);
      // Send order confirmation email
      try {
        await sendOrderConfirmationEmail({
          to: customer_email,
          customerName: customer_name,
          orderId: orderId,
          packageName: packageData.display_name,
          amount: amount,
          currency: packageData.currency,
          billingPeriod: billing_period,
          paymentUrl: paymentUrl,
        });
      } catch (emailError) {
        defaultLogger.error('Failed to send order confirmation email:', emailError);
        // Don't fail the order creation if email fails
      }
      syncLogger.info('Order confirmation email sent:', customer_email);
      res.json({
        success: true,
        order_id: orderId,
        transaction_id: transactionId,
        payment_url: paymentUrl,
        amount,
        currency: packageData.currency,
      });
    } catch (paymentError) {
      defaultLogger.error('Payment gateway error:', paymentError.response?.data || paymentError.message);
      syncLogger.error('Payment gateway error:', paymentError.response?.data || paymentError.message);
      // Check if it's a URL validation error
      const errorData = paymentError.response?.data;
      if (errorData && (errorData.message?.includes('URL') || errorData.message?.includes('url'))) {
        defaultLogger.error('URL validation error. Payment gateway may not accept localhost URLs.');
        defaultLogger.error('Current FRONTEND_URL:', FRONTEND_URL);
        defaultLogger.error('For development, consider using ngrok or a public URL.');
      }
      
      // Update order status to failed
      await pool.execute(
        'UPDATE hosting_orders SET status = "failed", payment_gateway_response = ? WHERE id = ?',
        [
          JSON.stringify({ error: paymentError.response?.data || paymentError.message }),
          orderResult.insertId,
        ]
      );

      return res.status(500).json({
        error: 'Failed to create payment order',
        details: paymentError.response?.data || paymentError.message,
        hint: errorData?.message?.includes('URL') 
          ? 'Payment gateway may not accept localhost URLs. Use a public URL or ngrok for development.'
          : undefined,
      });
    }
  } catch (error) {
    defaultLogger.error('Error creating hosting payment order:', error);
    defaultLogger.error('Error stack:', error.stack);
    defaultLogger.error('Request body:', req.body);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create payment order';
    let statusCode = 500;
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Check for database errors
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('customer_id')) {
      errorMessage = 'Database schema error. Please run migration: node scripts/migrate.js';
      statusCode = 500;
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = `Database field error: ${error.message}. Please run migration: node scripts/migrate.js`;
      statusCode = 500;
    } else if (error.response) {
      // Axios error from payment gateway
      errorMessage = error.response.data?.message || error.response.data?.error || errorMessage;
      statusCode = error.response.status || 500;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code
    });
  }
});

// Get order status
router.get('/orders/status/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;

    // Get order from database
    const [orders] = await pool.execute(
      `SELECT ho.*, hp.name as package_slug, hp.display_name as package_display_name
       FROM hosting_orders ho
       LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
       WHERE ho.transaction_id = ? OR ho.order_id = ?`,
      [transaction_id, transaction_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Also check with payment gateway
    try {
      const statusResponse = await axios.get(
        `${PAYMENT_GATEWAY_URL}/orders/status/${transaction_id}`,
        { timeout: 5000 }
      );

      const gatewayStatus = statusResponse.data.status;

      // Update order status if payment gateway status is different
      if (gatewayStatus !== order.status && gatewayStatus === 'paid') {
        await pool.execute(
          'UPDATE hosting_orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [gatewayStatus, order.id]
        );
        order.status = gatewayStatus;
      }

      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        package: {
          id: order.package_id,
          name: order.package_slug,
          display_name: order.package_display_name,
        },
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
        created_at: order.created_at,
        paid_at: order.paid_at,
        gateway_status: gatewayStatus,
      });
    } catch (gatewayError) {
      // If gateway check fails, return database status
      console.error('Error checking payment gateway status:', gatewayError.message);
      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        package: {
          id: order.package_id,
          name: order.package_slug,
          display_name: order.package_display_name,
        },
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
        created_at: order.created_at,
        paid_at: order.paid_at,
        note: 'Payment gateway status check failed, showing database status',
      });
    }
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Test webhook endpoint (for debugging)
router.get('/webhook/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Webhook endpoint is accessible',
    path: '/api/hosting/payments/webhook',
    method: 'POST'
  });
});

// Payment webhook handler
router.post('/webhook', async (req, res) => {
  try {
    defaultLogger.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));
    const { transaction_id, status, order_id, tnx_id } = req.body;

    if (!status) {
      defaultLogger.error('❌ Webhook missing status field');
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    // Find order by order_id (database ID) first, then transaction_id, order_id (string), or tnx_id
    // Priority: database ID > transaction_id > order_id string > tnx_id
    // The payment gateway may send order_id as the database ID (number) or as the order_id string
    let orders = [];
    
    // First, prioritize order_id if provided (most specific - database ID)
    if (order_id) {
      [orders] = await pool.execute(
        'SELECT * FROM hosting_orders WHERE id = ?',
        [order_id]
      );
      defaultLogger.log(`Searching by order_id (database ID): ${order_id}, found ${orders.length} order(s)`);
    }
    
    // If not found by database ID, try order_id as string
    if (orders.length === 0 && order_id) {
      [orders] = await pool.execute(
        'SELECT * FROM hosting_orders WHERE order_id = ?',
        [String(order_id)]
      );
      defaultLogger.log(`Searching by order_id (string): ${order_id}, found ${orders.length} order(s)`);
    }
    
    // If still not found, try transaction_id
    if (orders.length === 0 && transaction_id) {
      [orders] = await pool.execute(
        'SELECT * FROM hosting_orders WHERE transaction_id = ?',
        [transaction_id]
      );
      defaultLogger.log(`Searching by transaction_id: ${transaction_id}, found ${orders.length} order(s)`);
      
      // If multiple orders found with same transaction_id, prefer the one matching order_id if provided
      if (orders.length > 1 && order_id) {
        const matchingOrder = orders.find(o => o.id === Number(order_id) || o.order_id === String(order_id));
        if (matchingOrder) {
          orders = [matchingOrder];
          defaultLogger.log(`Multiple orders found with same transaction_id, using order matching order_id: ${order_id}`);
        } else {
          // If no exact match, use the most recent one
          orders = [orders.sort((a, b) => b.id - a.id)[0]];
          defaultLogger.log(`Multiple orders found with same transaction_id, using most recent order ID: ${orders[0].id}`);
        }
      }
    }
    
    // If still not found, try tnx_id
    if (orders.length === 0 && tnx_id) {
      [orders] = await pool.execute(
        'SELECT * FROM hosting_orders WHERE transaction_id = ? OR order_id = ?',
        [tnx_id, tnx_id]
      );
      defaultLogger.log(`Searching by tnx_id: ${tnx_id}, found ${orders.length} order(s)`);
    }

    if (orders.length === 0) {
      defaultLogger.error('❌ Webhook: Order not found');
      defaultLogger.error('   Searched with:', { 
        transaction_id, 
        order_id, 
        tnx_id
      });
      // Return 200 to prevent payment gateway from retrying
      return res.status(200).json({ 
        success: false, 
        message: 'Order not found',
        note: 'This is normal if the order was created outside the payment gateway flow'
      });
    }

    const order = orders[0];
    defaultLogger.log(`✅ Found order: ${order.order_id} (ID: ${order.id}), current status: ${order.status}, new status: ${status}`);

    // If order doesn't have customer_id, try to link it to a customer account by email
    if (!order.customer_id && order.customer_email) {
      try {
        const [customers] = await pool.execute(
          'SELECT id FROM customer_users WHERE email = ? LIMIT 1',
          [order.customer_email]
        );
        if (customers.length > 0) {
          await pool.execute(
            'UPDATE hosting_orders SET customer_id = ? WHERE id = ?',
            [customers[0].id, order.id]
          );
          defaultLogger.log(`✅ Linked order ${order.order_id} to customer account ${customers[0].id}`);
        }
      } catch (linkError) {
        defaultLogger.warn('Failed to link order to customer account:', linkError.message);
        // Don't fail the webhook if linking fails
      }
    }

    // Update order status and transaction_id if provided
    await pool.execute(
      `UPDATE hosting_orders 
       SET status = ?, 
           paid_at = CASE WHEN ? IN ('paid', 'completed') AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
           payment_gateway_response = ?,
           transaction_id = COALESCE(?, transaction_id)
       WHERE id = ?`,
      [status, status, JSON.stringify(req.body), transaction_id || tnx_id, order.id]
    );
    
    defaultLogger.log(`✅ Order ${order.order_id} status updated to: ${status}`);

    // Check if payment is successful
    const isPaymentSuccessful = (status === 'paid' || status === 'completed');
    const wasNotPaid = (order.status !== 'paid' && order.status !== 'completed');
    const accountNotCreated = !order.hosting_account_id;

    defaultLogger.log(`Payment check: isPaymentSuccessful=${isPaymentSuccessful}, wasNotPaid=${wasNotPaid}, accountNotCreated=${accountNotCreated}`);
    defaultLogger.log(`Order details: id=${order.id}, order_id=${order.order_id}, status=${order.status}, hosting_account_id=${order.hosting_account_id || 'null'}`);

    // Auto-generate invoice if payment is successful
    if (isPaymentSuccessful && wasNotPaid) {
      try {
        await generateInvoiceForOrder(order.id);
        defaultLogger.log(`✅ Invoice generated for order ${order.order_id}`);
      } catch (invoiceError) {
        defaultLogger.error('Failed to generate invoice:', invoiceError);
        // Don't fail the webhook if invoice generation fails
      }
    }

    // If payment is successful (status is 'paid' or 'completed'), create hosting account automatically
    // Check both the new status and old status to avoid duplicate account creation
    // Also check if account was already created (hosting_account_id is set)
    
    // Create account if payment is successful, order was not paid before, and account not created
    // Also allow creation if status is 'completed' and account not created (fallback for failed attempts)
    defaultLogger.log(`Account creation check: isPaymentSuccessful=${isPaymentSuccessful}, accountNotCreated=${accountNotCreated}, wasNotPaid=${wasNotPaid}, status=${status}`);
    if (isPaymentSuccessful && accountNotCreated && (wasNotPaid || status === 'completed')) {
      try {
        defaultLogger.log(`💰 Payment successful for order ${order.order_id}. Creating hosting account...`);
        
        // Get DirectAdmin config
        const config = await getDirectAdminConfig();
        if (!config) {
          defaultLogger.error('❌ No DirectAdmin configuration found. Cannot create account.');
          await pool.execute(
            'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
            [JSON.stringify({ ...req.body, error: 'No DirectAdmin config found' }), order.id]
          );
          return res.json({ success: true, message: 'Webhook processed, but account creation failed (no config)' });
        }
        
        // Get package details to determine package name
        const [packages] = await pool.execute(
          'SELECT * FROM hosting_packages WHERE id = ?',
          [order.package_id]
        );
        
        if (packages.length === 0) {
          defaultLogger.error(`❌ Package ${order.package_id} not found for order ${order.order_id}`);
          await pool.execute(
            'UPDATE hosting_orders SET status = "paid" WHERE id = ?',
            [order.id]
          );
          return res.json({ success: true, message: 'Webhook processed, but package not found' });
        }
        
        const packageData = packages[0];
        const packageName = packageData.name; // Use package name (slug) for DirectAdmin
        
        // Generate username if not provided (use domain without extension or customer email prefix)
        let username = order.username;
        if (!username) {
          if (order.domain) {
            username = order.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          } else {
            username = order.customer_email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          }
          // Ensure username is unique by appending random string if needed
          username = username.substring(0, 8) + Math.random().toString(36).substring(2, 6);
        }
        
        // Generate secure password if not provided
        const password = generatePassword(16);
        
        // Use domain from order or generate one
        let domain = order.domain;
        if (!domain) {
          // Generate a temporary domain or use a subdomain
          domain = `${username}.${config.whm_host || 'example.com'}`;
        }
        
        // Create account via DirectAdmin API
        const params = {
          action: 'create',
          add: 'Submit',
          username: username,
          email: order.customer_email,
          passwd: password,
          passwd2: password,
          domain: domain,
          package: packageName,
          ip: 'shared',
          notify: 'yes',
        };
        
        defaultLogger.log(`Creating DirectAdmin account: username=${username}, domain=${domain}, package=${packageName}`);
        defaultLogger.log('DirectAdmin request params:', JSON.stringify(params, null, 2));
        
        let daResult;
        try {
          daResult = await makeDirectAdminRequest(config, 'CMD_API_ACCOUNT_USER', params, 'POST');
          defaultLogger.log('DirectAdmin response received:', JSON.stringify(daResult, null, 2));
        } catch (daError) {
          defaultLogger.error('❌ DirectAdmin API request threw an error:');
          defaultLogger.error('   Error type:', typeof daError);
          defaultLogger.error('   Error message:', daError?.message || 'No message');
          defaultLogger.error('   Error stack:', daError?.stack || 'No stack');
          defaultLogger.error('   Error string:', String(daError));
          defaultLogger.error('   Full error:', JSON.stringify(daError, Object.getOwnPropertyNames(daError)));
          
          await pool.execute(
            'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
            [JSON.stringify({ 
              ...req.body, 
              da_error: daError?.message || String(daError),
              da_error_type: typeof daError
            }), order.id]
          );
          // Re-throw to be caught by outer catch block
          throw daError;
        }
        
        // Check for error in response - DirectAdmin can return errors in different formats
        const hasError = daResult.error || 
                        daResult.text === 'error' || 
                        (daResult.text && daResult.text.toLowerCase().includes('error')) ||
                        (daResult.error && daResult.error !== '');
        
        if (hasError) {
          defaultLogger.error('❌ DirectAdmin account creation failed - error in response');
          defaultLogger.error('   Response:', JSON.stringify(daResult, null, 2));
          await pool.execute(
            'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
            [JSON.stringify({ ...req.body, da_error: daResult.error || daResult.text || daResult }), order.id]
          );
          return res.json({ success: true, message: 'Webhook processed, but account creation failed' });
        }
        
        defaultLogger.log('✅ DirectAdmin account created successfully');
        
        // Save account to database
        let hostingAccountId;
        try {
          // Check if account already exists (might have been created manually or in a previous attempt)
          const [existingAccounts] = await pool.execute(
            'SELECT id FROM hosting_accounts WHERE domain = ? OR username = ? LIMIT 1',
            [domain, username]
          );
          
          if (existingAccounts.length > 0) {
            hostingAccountId = existingAccounts[0].id;
            defaultLogger.log(`✅ Found existing hosting account in database with ID: ${hostingAccountId}`);
            
            // Update existing account status to active if it was pending
            await pool.execute(
              'UPDATE hosting_accounts SET status = "active", customer_name = ?, customer_email = ?, customer_phone = ? WHERE id = ?',
              [order.customer_name, order.customer_email, order.customer_phone || null, hostingAccountId]
            );
          } else {
            // Create new account record
            const [accountResult] = await pool.execute(
              `INSERT INTO hosting_accounts 
               (domain, username, package_name, status, customer_name, customer_email, customer_phone)
               VALUES (?, ?, ?, 'active', ?, ?, ?)`,
              [domain, username, packageName, order.customer_name, order.customer_email, order.customer_phone || null]
            );
            
            hostingAccountId = accountResult.insertId;
            defaultLogger.log(`✅ Hosting account saved to database with ID: ${hostingAccountId}`);
          }
        } catch (dbError) {
          defaultLogger.error('❌ Failed to save/find hosting account in database:', dbError);
          defaultLogger.error('   Error details:', JSON.stringify(dbError, Object.getOwnPropertyNames(dbError)));
          // This is critical - we need the account ID to link the order
          throw new Error(`Failed to save hosting account to database: ${dbError.message}`);
        }
        
        // Update order with hosting account ID and mark as completed
        try {
          await pool.execute(
            'UPDATE hosting_orders SET status = "completed", hosting_account_id = ? WHERE id = ?',
            [hostingAccountId, order.id]
          );
          defaultLogger.log(`✅ Order ${order.order_id} updated with hosting_account_id: ${hostingAccountId} and status: completed`);
        } catch (updateError) {
          defaultLogger.error('❌ Failed to update order with hosting_account_id:', updateError);
          throw updateError; // This is critical, so re-throw
        }
        
        // Get DirectAdmin URL (construct from config)
        const protocol = config.whm_ssl !== false ? 'https' : 'http';
        const directAdminUrl = `${protocol}://${config.whm_host}:${config.whm_port || 2222}`;
        
        defaultLogger.log(`✅ Order ${order.order_id} completed successfully. Account ID: ${hostingAccountId}`);
        defaultLogger.log(`📧 Preparing to send credentials email to ${order.customer_email}...`);
        
        // Send credentials email to customer (AFTER account is created and saved)
        try {

          const emailResult = await sendHostingCredentialsEmail({
            to: order.customer_email,
            customerName: order.customer_name,
            domain: domain,
            username: username,
            password: password,
            packageName: packageName || order.package_name,
            directAdminUrl: directAdminUrl,
            cpanelUrl: null, // DirectAdmin doesn't use cPanel
          });
          defaultLogger.log(`✅ Credentials email sent successfully to ${order.customer_email}`);
          defaultLogger.log(`   Email message ID: ${emailResult?.messageId || 'N/A'}`);
        } catch (emailError) {
          defaultLogger.error('❌ Failed to send credentials email:');
          defaultLogger.error('   Error message:', emailError?.message || 'No message');
          defaultLogger.error('   Error stack:', emailError?.stack || 'No stack');
          defaultLogger.error('   Full error:', JSON.stringify(emailError, Object.getOwnPropertyNames(emailError)));
          // Don't fail the webhook if email fails, but log it clearly
          defaultLogger.warn('⚠️  Account created successfully but email failed. Customer should be notified manually.');
        }
      } catch (accountError) {
        defaultLogger.error('❌ Error creating hosting account after payment:');
        defaultLogger.error('   Error message:', accountError?.message || 'No error message');
        defaultLogger.error('   Error stack:', accountError?.stack || 'No stack trace');
        defaultLogger.error('   Error details:', JSON.stringify(accountError, Object.getOwnPropertyNames(accountError)));
        defaultLogger.error('   Order ID:', order.id);
        defaultLogger.error('   Order details:', {
          order_id: order.order_id,
          domain: order.domain,
          username: order.username,
          customer_email: order.customer_email,
          package_id: order.package_id
        });
        
        // Update order status to paid (even if account creation failed)
        await pool.execute(
          'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
          [JSON.stringify({ 
            ...req.body, 
            account_creation_error: accountError?.message || String(accountError),
            error_stack: accountError?.stack
          }), order.id]
        );
        // Don't fail the webhook, just log the error
      }
    }

    defaultLogger.log(`✅ Webhook processed successfully for order ${order.order_id}`);
    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    defaultLogger.error('❌ Error processing webhook:');
    defaultLogger.error('   Error message:', error?.message || 'No message');
    defaultLogger.error('   Error stack:', error?.stack || 'No stack');
    defaultLogger.error('   Error type:', typeof error);
    defaultLogger.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    defaultLogger.error('Webhook request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ error: 'Failed to process webhook', message: error?.message || 'Unknown error' });
  }
});

// Utility endpoint to link existing accounts to orders (admin only, for fixing data)
router.post('/orders/link-accounts', async (req, res) => {
  try {
    // Find orders that are completed/paid but don't have hosting_account_id
    // and try to link them to existing accounts by domain/username/email
    const [unlinkedOrders] = await pool.execute(
      `SELECT ho.id, ho.order_id, ho.domain, ho.username, ho.customer_email, ho.status
       FROM hosting_orders ho
       WHERE ho.status IN ('paid', 'completed')
         AND ho.hosting_account_id IS NULL
         AND (ho.domain IS NOT NULL OR ho.username IS NOT NULL)`
    );

    let linked = 0;
    let notFound = 0;

    for (const order of unlinkedOrders) {
      // Try to find account by domain or username
      let [accounts] = await pool.execute(
        'SELECT id FROM hosting_accounts WHERE domain = ? OR username = ? LIMIT 1',
        [order.domain || '', order.username || '']
      );

      // If not found, try by customer email
      if (accounts.length === 0 && order.customer_email) {
        [accounts] = await pool.execute(
          'SELECT id FROM hosting_accounts WHERE customer_email = ? LIMIT 1',
          [order.customer_email]
        );
      }

      if (accounts.length > 0) {
        await pool.execute(
          'UPDATE hosting_orders SET hosting_account_id = ? WHERE id = ?',
          [accounts[0].id, order.id]
        );
        linked++;
        defaultLogger.log(`✅ Linked order ${order.order_id} to account ${accounts[0].id}`);
      } else {
        notFound++;
        defaultLogger.warn(`⚠️  Could not find account for order ${order.order_id}`);
      }
    }

    res.json({
      success: true,
      message: `Linked ${linked} orders, ${notFound} not found`,
      linked,
      notFound,
      total: unlinkedOrders.length,
    });
  } catch (error) {
    defaultLogger.error('Error linking accounts to orders:', error);
    res.status(500).json({ error: 'Failed to link accounts' });
  }
});

// Get order by order_id (for frontend)
router.get('/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;

    const [orders] = await pool.execute(
      `SELECT ho.*, hp.name as package_slug, hp.display_name as package_display_name
       FROM hosting_orders ho
       LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
       WHERE ho.order_id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    res.json({
      order_id: order.order_id,
      transaction_id: order.transaction_id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      billing_period: order.billing_period,
      package: {
        id: order.package_id,
        name: order.package_slug,
        display_name: order.package_display_name,
      },
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      domain: order.domain,
      username: order.username,
      payment_url: order.payment_url,
      created_at: order.created_at,
      paid_at: order.paid_at,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;

