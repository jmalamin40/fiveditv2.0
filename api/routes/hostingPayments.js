const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const { defaultLogger, syncLogger } = require('../utils/logger');
const { sendHostingCredentialsEmail, sendOrderConfirmationEmail } = require('../utils/email');

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
    
    const makeRequest = (useSSL) => {
      const httpModule = useSSL ? require('https') : require('http');
      let url, options;
      
      if (method === 'GET') {
        const queryParams = new URLSearchParams(params);
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
          },
          rejectUnauthorized: false,
        };
      }
      
      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              // Try to parse as JSON first
              try {
                const json = JSON.parse(data);
                resolve(json);
              } catch {
                // If not JSON, parse as key=value or URL-encoded
                const parsed = {};
                if (data.includes('=')) {
                  const pairs = data.split('\n').filter(line => line.includes('='));
                  pairs.forEach(pair => {
                    const [key, ...valueParts] = pair.split('=');
                    if (key && valueParts.length > 0) {
                      parsed[key.trim()] = decodeURIComponent(valueParts.join('=').trim());
                    }
                  });
                }
                resolve(parsed);
              }
            } else {
              reject(new Error(`DirectAdmin API error: ${res.statusCode} - ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        if (useSSL && trySSL) {
          // Retry with HTTP if SSL fails
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

// Create payment order for hosting
router.post('/orders', async (req, res) => {
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
    const [orderResult] = await pool.execute(
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
    syncLogger.info('Hosting order created:', orderResult);
    
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
        });
      } catch (emailError) {
        defaultLogger.error('Failed to send order confirmation email:', emailError);
        // Don't fail the order creation if email fails
      }

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
    console.error('Error creating hosting payment order:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
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

// Payment webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const { transaction_id, status, order_id } = req.body;

    if (!transaction_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find order by transaction_id or order_id
    const [orders] = await pool.execute(
      'SELECT * FROM hosting_orders WHERE transaction_id = ? OR order_id = ?',
      [transaction_id, order_id]
    );

    if (orders.length === 0) {
      console.error('Webhook: Order not found', { transaction_id, order_id });
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Update order status
    await pool.execute(
      `UPDATE hosting_orders 
       SET status = ?, 
           paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
           payment_gateway_response = ?
       WHERE id = ?`,
      [status, status, JSON.stringify(req.body), order.id]
    );

    // If payment is successful, create hosting account automatically
    if (status === 'paid' && order.status !== 'paid') {
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
        const daResult = await makeDirectAdminRequest(config, 'CMD_API_ACCOUNT_USER', params, 'POST');
        
        if (daResult.error || daResult.text === 'error') {
          defaultLogger.error('❌ DirectAdmin account creation failed:', daResult);
          await pool.execute(
            'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
            [JSON.stringify({ ...req.body, da_error: daResult }), order.id]
          );
          return res.json({ success: true, message: 'Webhook processed, but account creation failed' });
        }
        
        defaultLogger.log('✅ DirectAdmin account created successfully');
        
        // Save account to database
        const [accountResult] = await pool.execute(
          `INSERT INTO hosting_accounts 
           (domain, username, package_name, status, customer_name, customer_email, customer_phone)
           VALUES (?, ?, ?, 'active', ?, ?, ?)`,
          [domain, username, packageName, order.customer_name, order.customer_email, order.customer_phone]
        );
        
        const hostingAccountId = accountResult.insertId;
        
        // Update order with hosting account ID and mark as completed
        await pool.execute(
          'UPDATE hosting_orders SET status = "completed", hosting_account_id = ? WHERE id = ?',
          [hostingAccountId, order.id]
        );
        
        // Get DirectAdmin URL (construct from config)
        const protocol = config.whm_ssl !== false ? 'https' : 'http';
        const directAdminUrl = `${protocol}://${config.whm_host}:${config.whm_port || 2222}`;
        
        // Send credentials email to customer
        try {
          await sendHostingCredentialsEmail({
            to: order.customer_email,
            customerName: order.customer_name,
            domain: domain,
            username: username,
            password: password,
            packageName: order.package_name,
            directAdminUrl: directAdminUrl,
            cpanelUrl: null, // DirectAdmin doesn't use cPanel
          });
          defaultLogger.log(`✅ Credentials email sent to ${order.customer_email}`);
        } catch (emailError) {
          defaultLogger.error('❌ Failed to send credentials email:', emailError);
          // Don't fail the webhook if email fails
        }
        
        defaultLogger.log(`✅ Order ${order.order_id} completed successfully. Account ID: ${hostingAccountId}`);
      } catch (accountError) {
        defaultLogger.error('❌ Error creating hosting account after payment:', accountError);
        // Update order status to paid (even if account creation failed)
        await pool.execute(
          'UPDATE hosting_orders SET status = "paid", payment_gateway_response = ? WHERE id = ?',
          [JSON.stringify({ ...req.body, account_creation_error: accountError.message }), order.id]
        );
        // Don't fail the webhook, just log the error
      }
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
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

