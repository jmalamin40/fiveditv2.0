const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { defaultLogger } = require('../utils/logger');

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api-pay.fivedit.com';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'your-api-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fivedit.com';
const SMM_SUBDOMAIN_BASE = process.env.SMM_SUBDOMAIN_BASE || 'fivedit.com';
const SMM_INSTANCES_DIR = process.env.SMM_INSTANCES_PATH || path.join(__dirname, '..', 'smm_instances');
// Source of the SMM script (set SMM_SOURCE_PATH in env if api/ecomerce_dist is elsewhere, e.g. in production)
const SMM_SOURCE_DIR = process.env.SMM_SOURCE_PATH || path.join(__dirname, '..', 'ecomerce_dist');
const {
  getSmmDaConfig,
  createSubdomainInDirectAdmin,
  createDomainInDirectAdmin,
} = require('../utils/directAdminSmm');

// Optional customer auth (same pattern as hosting)
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
    } catch (e) {
      // continue without customer
    }
  }
  next();
}

// Sanitize string for folder name: alphanumeric and underscore only
function sanitizeFolderName(str) {
  if (!str || typeof str !== 'string') return 'instance';
  return str
    .toLowerCase()
    .replace(/\./g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 64) || 'instance';
}

// Recursively copy directory
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  if (!fs.statSync(src).isDirectory()) {
    throw new Error(`Source is not a directory: ${src}`);
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Write a minimal placeholder index.php when source is missing (so domain does not 404)
function writePlaceholderIndexPhp(destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const indexPath = path.join(destDir, 'index.php');
  const content = `<?php
// SMM site – placeholder. Upload your script or set SMM_SOURCE_PATH to api/ecomerce_dist.
header('Content-Type: text/html; charset=utf-8');
echo '<h1>Site is being set up</h1><p>Content will appear shortly. If this persists, contact support.</p>';
`;
  fs.writeFileSync(indexPath, content, 'utf8');
  defaultLogger.warn(`SMM: source dir missing, wrote placeholder ${indexPath}. Set SMM_SOURCE_PATH or add api/ecomerce_dist.`);
}

// Provision SMM instance: copy ecomerce_dist to target dir (DA docroot or smm_instances)
function provisionSmmInstanceToPath(destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  if (!fs.existsSync(SMM_SOURCE_DIR)) {
    defaultLogger.error(`SMM: source directory not found: ${SMM_SOURCE_DIR}. Set SMM_SOURCE_PATH in env or add api/ecomerce_dist.`);
    writePlaceholderIndexPhp(destDir);
    return destDir;
  }
  if (!fs.statSync(SMM_SOURCE_DIR).isDirectory()) {
    defaultLogger.error(`SMM: source path is not a directory: ${SMM_SOURCE_DIR}`);
    writePlaceholderIndexPhp(destDir);
    return destDir;
  }
  copyDirSync(SMM_SOURCE_DIR, destDir);
  defaultLogger.log(`SMM instance provisioned: ${destDir}`);
  return destDir;
}

// Fallback: provision to smm_instances/<folder_name> only (no DirectAdmin)
function provisionSmmInstance(folderName) {
  const destDir = path.join(SMM_INSTANCES_DIR, folderName);
  return provisionSmmInstanceToPath(destDir);
}

// ----- Public: products -----
router.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, display_name, description, price, currency, is_active FROM smm_website_products WHERE is_active = TRUE'
    );
    res.json({ products: rows });
  } catch (error) {
    defaultLogger.error('Error fetching SMM products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, display_name, description, price, currency FROM smm_website_products WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch (error) {
    defaultLogger.error('Error fetching SMM product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ----- Create order -----
router.post('/payments/orders', optionalCustomerAuth, async (req, res) => {
  try {
    const {
      product_id,
      customer_name,
      customer_email,
      customer_phone,
      domain,
      subdomain_slug,
    } = req.body;

    if (!product_id || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required fields: product_id, customer_name, customer_email' });
    }
    if (!domain && !subdomain_slug) {
      return res.status(400).json({ error: 'Provide either domain (custom domain) or subdomain_slug (for our subdomain)' });
    }

    let customer_id = null;
    if (req.customer && req.customer.id) {
      const [cust] = await pool.execute(
        'SELECT id FROM customer_users WHERE id = ? AND email = ?',
        [req.customer.id, customer_email]
      );
      if (cust.length > 0) customer_id = cust[0].id;
    }

    const [products] = await pool.execute(
      'SELECT * FROM smm_website_products WHERE id = ? AND is_active = TRUE',
      [product_id]
    );
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = products[0];
    const amount = Number(product.price);

    const orderId = `SMM-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const validateUrl = (url) => {
      try {
        return new URL(url).toString();
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }
    };
    const returnUrl = validateUrl(`${FRONTEND_URL}/smm/payment/success?order_id=${encodeURIComponent(orderId)}`);
    const cancelUrl = validateUrl(`${FRONTEND_URL}/smm/payment/cancel?order_id=${encodeURIComponent(orderId)}`);
    const webhookUrl = validateUrl(`${process.env.API_BASE_URL || 'http://localhost:3004'}/api/smm/payments/webhook`);

    const [insertResult] = await pool.execute(
      `INSERT INTO smm_website_orders (
        order_id, product_id, customer_id, customer_name, customer_email, customer_phone,
        domain, subdomain_slug, amount, currency, status, return_url, cancel_url, webhook_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        orderId, product_id, customer_id, customer_name, customer_email, customer_phone || null,
        domain || null, subdomain_slug ? String(subdomain_slug).trim().toLowerCase() : null,
        amount, product.currency, returnUrl, cancelUrl, webhookUrl,
      ]
    );
    const dbOrderId = insertResult.insertId;
    defaultLogger.log(`SMM order created: ${orderId} (DB id: ${dbOrderId})`);

    const paymentPayload = {
      order_id: dbOrderId,
      amount: amount.toFixed(2),
      currency: product.currency,
      customer_name,
      customer_email,
      customer_phone: customer_phone || '',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      api_key: PAYMENT_API_KEY,
      webhook_url: webhookUrl,
    };

    const payRes = await axios.post(
      `${PAYMENT_GATEWAY_URL}/orders`,
      paymentPayload,
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const transactionId = payRes.data.transaction_id;
    const paymentUrl = payRes.data.payment_url;

    await pool.execute(
      'UPDATE smm_website_orders SET transaction_id = ?, payment_url = ?, payment_gateway_response = ? WHERE id = ?',
      [transactionId, paymentUrl, JSON.stringify(payRes.data), dbOrderId]
    );

    res.json({
      success: true,
      order_id: orderId,
      transaction_id: transactionId,
      payment_url: paymentUrl,
      amount,
      currency: product.currency,
    });
  } catch (error) {
    defaultLogger.error('SMM create order error:', error?.response?.data || error.message);
    if (error.response?.status) {
      return res.status(error.response.status).json({
        error: error.response.data?.message || error.response.data?.error || 'Payment gateway error',
      });
    }
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// ----- Webhook -----
router.post('/payments/webhook', async (req, res) => {
  try {
    defaultLogger.log('🔔 SMM Webhook received:', JSON.stringify(req.body, null, 2));
    const { order_id, status, transaction_id, tnx_id } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    let orders = [];
    if (order_id) {
      [orders] = await pool.execute('SELECT * FROM smm_website_orders WHERE id = ?', [order_id]);
    }
    if (orders.length === 0 && order_id) {
      [orders] = await pool.execute('SELECT * FROM smm_website_orders WHERE order_id = ?', [String(order_id)]);
    }
    if (orders.length === 0 && transaction_id) {
      [orders] = await pool.execute('SELECT * FROM smm_website_orders WHERE transaction_id = ?', [transaction_id]);
    }
    if (orders.length === 0 && tnx_id) {
      [orders] = await pool.execute(
        'SELECT * FROM smm_website_orders WHERE transaction_id = ? OR order_id = ?',
        [tnx_id, tnx_id]
      );
    }

    if (orders.length === 0) {
      defaultLogger.error('SMM Webhook: order not found');
      return res.status(200).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    defaultLogger.log(`SMM Webhook: order ${order.order_id} (id: ${order.id}), status: ${status}`);

    await pool.execute(
      'UPDATE smm_website_orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status === 'completed' ? 'completed' : status, order.id]
    );

    if (order.customer_id === null && order.customer_email) {
      const [cust] = await pool.execute('SELECT id FROM customer_users WHERE email = ? LIMIT 1', [order.customer_email]);
      if (cust.length > 0) {
        await pool.execute('UPDATE smm_website_orders SET customer_id = ? WHERE id = ?', [cust[0].id, order.id]);
      }
    }

    const isPaid = status === 'completed' || status === 'paid';
    const alreadyHasInstance = order.smm_instance_id != null;

    if (isPaid && !alreadyHasInstance) {
      const folderName = order.subdomain_slug
        ? sanitizeFolderName(order.subdomain_slug)
        : sanitizeFolderName(order.domain || order.order_id);
      const baseHost = SMM_SUBDOMAIN_BASE.replace(/^https?:\/\//, '').split('/')[0];
      const subdomainPart = order.subdomain_slug
        ? String(order.subdomain_slug).toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 64) || folderName
        : folderName;
      const siteUrl = order.subdomain_slug
        ? `https://${subdomainPart}.${baseHost}`
        : (order.domain ? `https://${order.domain.replace(/^https?:\/\//, '')}` : `https://${subdomainPart}.${baseHost}`);

      let instanceId = null;
      let folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
      let usedDirectAdmin = false;

      try {
        const daConfig = await getSmmDaConfig(pool);
        if (daConfig) {
          try {
            if (order.subdomain_slug) {
              const docroot = await createSubdomainInDirectAdmin(daConfig, baseHost, subdomainPart);
              folderPathToStore = docroot;
              usedDirectAdmin = true;
              try {
                provisionSmmInstanceToPath(docroot);
              } catch (copyErr) {
                defaultLogger.error('SMM: copy to DA docroot failed (check permissions or source path):', copyErr.message);
                defaultLogger.warn('SMM: writing placeholder to docroot; copy api/ecomerce_dist to ' + docroot + ' manually if needed.');
                try {
                  writePlaceholderIndexPhp(docroot);
                } catch (e) {
                  defaultLogger.error('SMM: could not write placeholder to docroot:', e.message);
                }
                if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
                provisionSmmInstance(folderName);
                folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
              }
            } else if (order.domain) {
              const cleanDomain = order.domain.replace(/^https?:\/\//, '').split('/')[0];
              const docroot = await createDomainInDirectAdmin(daConfig, cleanDomain);
              folderPathToStore = docroot;
              usedDirectAdmin = true;
              try {
                provisionSmmInstanceToPath(docroot);
              } catch (copyErr) {
                defaultLogger.error('SMM: copy to DA docroot failed (check permissions or source path):', copyErr.message);
                defaultLogger.warn('SMM: writing placeholder to docroot; copy api/ecomerce_dist to ' + docroot + ' manually if needed.');
                try {
                  writePlaceholderIndexPhp(docroot);
                } catch (e) {
                  defaultLogger.error('SMM: could not write placeholder to docroot:', e.message);
                }
                if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
                provisionSmmInstance(folderName);
                folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
              }
            }
          } catch (daErr) {
            defaultLogger.error('SMM DirectAdmin create failed, using smm_instances only:', daErr.message);
            if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
            provisionSmmInstance(folderName);
            folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
          }
        } else {
          if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
          provisionSmmInstance(folderName);
        }

        const folderPathRelative = path.isAbsolute(folderPathToStore)
          ? folderPathToStore
          : path.relative(path.join(__dirname, '..', '..'), folderPathToStore);
        const [ins] = await pool.execute(
          `INSERT INTO smm_instances (order_id, domain, folder_name, folder_path, site_url, customer_email, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [
            order.id,
            order.domain || siteUrl.replace(/^https?:\/\//, '').split('/')[0],
            folderName,
            folderPathRelative,
            siteUrl,
            order.customer_email,
          ]
        );
        instanceId = ins.insertId;
        await pool.execute(
          'UPDATE smm_website_orders SET smm_instance_id = ?, status = ? WHERE id = ?',
          [instanceId, 'completed', order.id]
        );
        defaultLogger.log(`SMM instance created: id=${instanceId}, folder=${folderName}, site_url=${siteUrl}, da=${usedDirectAdmin}`);
      } catch (provisionError) {
        defaultLogger.error('SMM provisioning error:', provisionError);
        // do not fail webhook; order is already paid
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    defaultLogger.error('SMM webhook error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get order status by order_id (string) for success page
router.get('/payments/orders/:order_id', async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, p.display_name as product_display_name
       FROM smm_website_orders o
       LEFT JOIN smm_website_products p ON o.product_id = p.id
       WHERE o.order_id = ?`,
      [req.params.order_id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    let instance = null;
    if (order.smm_instance_id) {
      const [instances] = await pool.execute('SELECT * FROM smm_instances WHERE id = ?', [order.smm_instance_id]);
      if (instances.length > 0) instance = instances[0];
    }
    res.json({ order, instance });
  } catch (error) {
    defaultLogger.error('SMM get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
