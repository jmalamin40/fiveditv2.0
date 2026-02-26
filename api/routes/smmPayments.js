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
const { setupSupabaseForInstance, createSupabaseAuthUser, replaceSupabaseConfigInCodebase, getSupabaseConfig, getSupabaseApiKeys } = require('../utils/supabaseSmm');
const {
  ensureStepRows,
  clearStaleRunningSteps,
  recordStepStart,
  recordStepEnd,
  getSteps,
} = require('../utils/smmProvisioning');
const { sendSmmCredentialsEmail } = require('../utils/email');
const crypto = require('crypto');

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

// Write .htaccess after copying files (DirectoryIndex, optional rewrite for PHP apps)
function writeHtaccess(destDir) {
  if (!destDir) return;
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const htaccessPath = path.join(destDir, '.htaccess');
    const content = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # If file or directory exists, serve it directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Otherwise, redirect all requests to index.html
  RewriteRule ^ index.html [L]
</IfModule>

# Enable gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE
    text/html
    text/plain
    text/css
    application/javascript
    application/json
    application/font-woff
    application/font-woff2
    image/svg+xml
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
`;
    fs.writeFileSync(htaccessPath, content, 'utf8');
    defaultLogger.log(`SMM: wrote .htaccess to ${destDir}`);
  } catch (e) {
    defaultLogger.warn('SMM: could not write .htaccess:', e.message);
  }
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
  writeHtaccess(destDir);
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

    const isPaid = status === 'completed' || status === 'paid';
    const oneTimeToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.execute(
      `UPDATE smm_website_orders SET status = ?, paid_at = CURRENT_TIMESTAMP,
       one_time_login_token = ?, one_time_login_expires_at = ?
       WHERE id = ?`,
      [status === 'completed' ? 'completed' : status, oneTimeToken, tokenExpires, order.id]
    );

    if (order.customer_id === null && order.customer_email) {
      const [cust] = await pool.execute('SELECT id FROM customer_users WHERE email = ? LIMIT 1', [order.customer_email]);
      if (cust.length > 0) {
        await pool.execute('UPDATE smm_website_orders SET customer_id = ? WHERE id = ?', [cust[0].id, order.id]);
      }
    }

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

      ensureStepRows(pool, order.id);
      await clearStaleRunningSteps(pool, order.id);

      let folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
      let usedDirectAdmin = false;
      let supabaseUrl = null;
      let supabaseRef = null;
      let adminPassword = null;
      let supabaseProjectResponse = null;
      let supabaseUserEmail = null;
      const steps = await getSteps(pool, order.id);
      const stepStatus = Object.fromEntries(steps.map((s) => [s.step_name, s.status]));

      const runStep = async (name, fn) => {
        if (stepStatus[name] === 'success') return true;
        await recordStepStart(pool, order.id, name);
        let ended = false;
        try {
          await fn();
          await recordStepEnd(pool, order.id, name, true, null, null);
          ended = true;
          return true;
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || String(err);
          await recordStepEnd(pool, order.id, name, false, msg, null);
          ended = true;
          defaultLogger.error(`SMM step ${name} failed:`, msg);
          return false;
        } finally {
          if (!ended) {
            await recordStepEnd(pool, order.id, name, false, 'Step did not complete (timeout or error)', null);
          }
        }
      };

      // Step 1: DirectAdmin domain/subdomain
      const daOk = await runStep('directadmin_domain', async () => {
        const daConfig = await getSmmDaConfig(pool);
        if (daConfig) {
          if (order.subdomain_slug) {
            const docroot = await createSubdomainInDirectAdmin(daConfig, baseHost, subdomainPart);
            folderPathToStore = docroot;
            usedDirectAdmin = true;
          } else if (order.domain) {
            const cleanDomain = order.domain.replace(/^https?:\/\//, '').split('/')[0];
            const docroot = await createDomainInDirectAdmin(daConfig, cleanDomain);
            folderPathToStore = docroot;
            usedDirectAdmin = true;
          }
        }
      });
      if (!daOk) {
        return res.status(200).json({ success: true, message: 'Webhook processed; provisioning step failed', retry: true });
      }

      // Step 2: Copy files
      const copyOk = await runStep('copy_files', async () => {
        if (usedDirectAdmin && folderPathToStore) {
          try {
            provisionSmmInstanceToPath(folderPathToStore);
            writeHtaccess(folderPathToStore);
          } catch (copyErr) {
            defaultLogger.warn('SMM: copy to DA docroot failed, using smm_instances fallback:', copyErr.message);
            if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
            provisionSmmInstance(folderName);
            folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
            writeHtaccess(folderPathToStore);
          }
        } else {
          if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
          provisionSmmInstance(folderName);
          writeHtaccess(path.join(SMM_INSTANCES_DIR, folderName));
        }
      });
      if (!copyOk) {
        return res.status(200).json({ success: true, message: 'Webhook processed; provisioning step failed', retry: true });
      }

      if (getSupabaseConfig()) {
        const projectName = `smm-${order.id}-${folderName}`.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').substring(0, 50);
        adminPassword = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, 'a') + 'A1!';

        const supabaseOk = await runStep('supabase_project', async () => {
          const supabase = await setupSupabaseForInstance(projectName, adminPassword);
          if (!supabase || !supabase.url) throw new Error('Supabase project creation failed');
          supabaseUrl = supabase.url;
          supabaseRef = supabase.url.replace('https://', '').split('.')[0];
          supabaseProjectResponse = supabase.projectResponse || null;
        });
        if (!supabaseOk) {
          return res.status(200).json({ success: true, message: 'Webhook processed; provisioning step failed', retry: true });
        }

        await runStep('supabase_schema', async () => {
          /* schema is run inside setupSupabaseForInstance */
        });

        await runStep('supabase_user', async () => {
          const keys = await getSupabaseApiKeys(supabaseRef, getSupabaseConfig().token);
          const serviceKey = keys?.serviceRoleKey;
          const email = order.customer_email || 'admin@example.com';
          if (serviceKey) {
            const u = await createSupabaseAuthUser(supabaseUrl, serviceKey, {
              email,
              password: adminPassword,
              email_confirm: true,
            });
            if (!u) throw new Error('Create auth user failed');
            supabaseUserEmail = u.email || email;
            // Send credentials email to customer (non-blocking: log only if SMTP not configured or send fails)
            try {
              const result = await sendSmmCredentialsEmail({
                to: order.customer_email || email,
                customerName: order.customer_name || null,
                siteUrl,
                loginEmail: supabaseUserEmail,
                password: adminPassword,
              });
              if (result.skipped) {
                defaultLogger.warn('SMM credentials email skipped:', result.reason || 'unknown');
              }
            } catch (emailErr) {
              defaultLogger.error('SMM credentials email failed (user was created):', emailErr?.message || emailErr);
            }
          }
        });

        await runStep('replace_config', async () => {
          const keys = await getSupabaseApiKeys(supabaseRef, getSupabaseConfig().token);
          replaceSupabaseConfigInCodebase(folderPathToStore, supabaseUrl, keys?.anonKey || '');
        });
      } else {
        await recordStepEnd(pool, order.id, 'supabase_project', true, null, null);
        await recordStepEnd(pool, order.id, 'supabase_schema', true, null, null);
        await recordStepEnd(pool, order.id, 'supabase_user', true, null, null);
        await recordStepEnd(pool, order.id, 'replace_config', true, null, null);
      }

      const insertOk = await runStep('insert_instance', async () => {
        const folderPathRelative = path.isAbsolute(folderPathToStore)
          ? folderPathToStore
          : path.relative(path.join(__dirname, '..', '..'), folderPathToStore);
        let adminEnc = null;
        if (adminPassword && process.env.SMM_ENCRYPT_KEY) {
          const key = Buffer.from(process.env.SMM_ENCRYPT_KEY.slice(0, 32).padEnd(32, '0'));
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          const enc = Buffer.concat([cipher.update(adminPassword, 'utf8'), cipher.final()]);
          const authTag = cipher.getAuthTag();
          adminEnc = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + enc.toString('hex');
        }
        const projectResponseJson = supabaseProjectResponse ? JSON.stringify(supabaseProjectResponse) : null;
        const [ins] = await pool.execute(
          `INSERT INTO smm_instances (order_id, domain, folder_name, folder_path, site_url, customer_email, status, supabase_project_ref, supabase_project_response, supabase_user_email, admin_password_encrypted)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
          [
            order.id,
            order.domain || siteUrl.replace(/^https?:\/\//, '').split('/')[0],
            folderName,
            folderPathRelative,
            siteUrl,
            order.customer_email,
            supabaseRef,
            projectResponseJson,
            supabaseUserEmail,
            adminEnc,
          ]
        );
        const instanceId = ins.insertId;
        await pool.execute(
          'UPDATE smm_website_orders SET smm_instance_id = ?, status = ? WHERE id = ?',
          [instanceId, 'completed', order.id]
        );
        defaultLogger.log(`SMM instance created: id=${instanceId}, folder=${folderName}, site_url=${siteUrl}`);
      });
      if (!insertOk) {
        return res.status(200).json({ success: true, message: 'Webhook processed; provisioning step failed', retry: true });
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
    const steps = await getSteps(pool, order.id);
    res.json({ order, instance, provisioning_steps: steps });
  } catch (error) {
    defaultLogger.error('SMM get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// One-time guest session token for auto-login after purchase (no auth)
router.get('/payments/orders/:order_id/guest-session', async (req, res) => {
  try {
    const [orders] = await pool.execute(
      `SELECT one_time_login_token, one_time_login_expires_at, status
       FROM smm_website_orders WHERE order_id = ? LIMIT 1`,
      [req.params.order_id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const o = orders[0];
    if (o.status !== 'completed' && o.status !== 'paid') return res.status(400).json({ error: 'Order not paid' });
    if (!o.one_time_login_token || !o.one_time_login_expires_at) return res.status(400).json({ error: 'No session available' });
    if (new Date(o.one_time_login_expires_at) <= new Date()) return res.status(400).json({ error: 'Session expired' });
    res.json({ token: o.one_time_login_token, expires_at: o.one_time_login_expires_at });
  } catch (error) {
    defaultLogger.error('SMM guest-session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Get provisioning steps for an order (by order_id string)
router.get('/payments/orders/:order_id/provisioning', async (req, res) => {
  try {
    const [orders] = await pool.execute(
      'SELECT id FROM smm_website_orders WHERE order_id = ? LIMIT 1',
      [req.params.order_id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const steps = await getSteps(pool, orders[0].id);
    res.json({ steps });
  } catch (error) {
    defaultLogger.error('SMM get provisioning error:', error);
    res.status(500).json({ error: 'Failed to fetch provisioning steps' });
  }
});

// Retry provisioning: requires customer auth or one_time_login_token in body
router.post('/payments/provision-retry', optionalCustomerAuth, async (req, res) => {
  try {
    const orderIdStr = req.body?.order_id || req.query?.order_id;
    const token = req.body?.token;
    if (!orderIdStr) return res.status(400).json({ error: 'order_id required' });

    const [orders] = await pool.execute(
      'SELECT * FROM smm_website_orders WHERE order_id = ? LIMIT 1',
      [orderIdStr]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (order.smm_instance_id) {
      return res.status(400).json({ error: 'Instance already created' });
    }
    if (order.status !== 'completed' && order.status !== 'paid') {
      return res.status(400).json({ error: 'Order not paid' });
    }

    const customerId = req.customer?.id;
    const customerEmail = req.customer?.email;
    const validToken = token && order.one_time_login_token && order.one_time_login_token === token &&
      order.one_time_login_expires_at && new Date(order.one_time_login_expires_at) > new Date();
    const validCustomer = customerId && (Number(order.customer_id) === Number(customerId) || order.customer_email === customerEmail);
    if (!validToken && !validCustomer) {
      return res.status(403).json({ error: 'Unauthorized: use customer login or valid one-time token' });
    }

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

    ensureStepRows(pool, order.id);
    await clearStaleRunningSteps(pool, order.id);
    let folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
    let usedDirectAdmin = false;
    let supabaseUrl = null;
    let supabaseRef = null;
    let adminPassword = null;
    let supabaseProjectResponse = null;
    let supabaseUserEmail = null;
    const steps = await getSteps(pool, order.id);
    const stepStatus = Object.fromEntries(steps.map((s) => [s.step_name, s.status]));

    const runStep = async (name, fn) => {
      if (stepStatus[name] === 'success') return true;
      await recordStepStart(pool, order.id, name);
      let ended = false;
      try {
        await fn();
        await recordStepEnd(pool, order.id, name, true, null, null);
        ended = true;
        return true;
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || String(err);
        await recordStepEnd(pool, order.id, name, false, msg, null);
        ended = true;
        defaultLogger.error(`SMM step ${name} failed:`, msg);
        return false;
      } finally {
        if (!ended) {
          await recordStepEnd(pool, order.id, name, false, 'Step did not complete (timeout or error)', null);
        }
      }
    };

    const daOk = await runStep('directadmin_domain', async () => {
      const daConfig = await getSmmDaConfig(pool);
      if (daConfig) {
        if (order.subdomain_slug) {
          const docroot = await createSubdomainInDirectAdmin(daConfig, baseHost, subdomainPart);
          folderPathToStore = docroot;
          usedDirectAdmin = true;
        } else if (order.domain) {
          const cleanDomain = order.domain.replace(/^https?:\/\//, '').split('/')[0];
          const docroot = await createDomainInDirectAdmin(daConfig, cleanDomain);
          folderPathToStore = docroot;
          usedDirectAdmin = true;
        }
      }
    });
    if (!daOk) return res.status(200).json({ success: false, message: 'Step failed', steps: await getSteps(pool, order.id) });

    const copyOk = await runStep('copy_files', async () => {
      if (usedDirectAdmin && folderPathToStore) {
        try {
          provisionSmmInstanceToPath(folderPathToStore);
          writeHtaccess(folderPathToStore);
        } catch (copyErr) {
          if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
          provisionSmmInstance(folderName);
          folderPathToStore = path.join(SMM_INSTANCES_DIR, folderName);
          writeHtaccess(folderPathToStore);
        }
      } else {
        if (!fs.existsSync(SMM_INSTANCES_DIR)) fs.mkdirSync(SMM_INSTANCES_DIR, { recursive: true });
        provisionSmmInstance(folderName);
        writeHtaccess(path.join(SMM_INSTANCES_DIR, folderName));
      }
    });
    if (!copyOk) return res.status(200).json({ success: false, message: 'Step failed', steps: await getSteps(pool, order.id) });

    if (getSupabaseConfig()) {
      const projectName = `smm-${order.id}-${folderName}`.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').substring(0, 50);
      adminPassword = crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, 'a') + 'A1!';
      const supabaseOk = await runStep('supabase_project', async () => {
        const supabase = await setupSupabaseForInstance(projectName, adminPassword);
        if (!supabase || !supabase.url) throw new Error('Supabase project creation failed');
        supabaseUrl = supabase.url;
        supabaseRef = supabase.url.replace('https://', '').split('.')[0];
        supabaseProjectResponse = supabase.projectResponse || null;
      });
      if (!supabaseOk) return res.status(200).json({ success: false, message: 'Step failed', steps: await getSteps(pool, order.id) });
      await runStep('supabase_schema', async () => {});
      await runStep('supabase_user', async () => {
        const keys = await getSupabaseApiKeys(supabaseRef, getSupabaseConfig().token);
        const email = order.customer_email || 'admin@example.com';
        if (keys?.serviceRoleKey) {
          const u = await createSupabaseAuthUser(supabaseUrl, keys.serviceRoleKey, {
            email,
            password: adminPassword,
            email_confirm: true,
          });
          if (!u) throw new Error('Create auth user failed');
          supabaseUserEmail = u.email || email;
          try {
            const result = await sendSmmCredentialsEmail({
              to: order.customer_email || email,
              customerName: order.customer_name || null,
              siteUrl,
              loginEmail: supabaseUserEmail,
              password: adminPassword,
            });
            if (result.skipped) defaultLogger.warn('SMM credentials email skipped:', result.reason || 'unknown');
          } catch (emailErr) {
            defaultLogger.error('SMM credentials email failed (user was created):', emailErr?.message || emailErr);
          }
        }
      });
      await runStep('replace_config', async () => {
        const keys = await getSupabaseApiKeys(supabaseRef, getSupabaseConfig().token);
        replaceSupabaseConfigInCodebase(folderPathToStore, supabaseUrl, keys?.anonKey || '');
      });
    } else {
      await recordStepEnd(pool, order.id, 'supabase_project', true, null, null);
      await recordStepEnd(pool, order.id, 'supabase_schema', true, null, null);
      await recordStepEnd(pool, order.id, 'supabase_user', true, null, null);
      await recordStepEnd(pool, order.id, 'replace_config', true, null, null);
    }

    const insertOk = await runStep('insert_instance', async () => {
      const folderPathRelative = path.isAbsolute(folderPathToStore)
        ? folderPathToStore
        : path.relative(path.join(__dirname, '..', '..'), folderPathToStore);
      let adminEnc = null;
      if (adminPassword && process.env.SMM_ENCRYPT_KEY) {
        const key = Buffer.from(process.env.SMM_ENCRYPT_KEY.slice(0, 32).padEnd(32, '0'));
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const enc = Buffer.concat([cipher.update(adminPassword, 'utf8'), cipher.final()]);
        adminEnc = iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + enc.toString('hex');
      }
      const projectResponseJson = supabaseProjectResponse ? JSON.stringify(supabaseProjectResponse) : null;
      const [ins] = await pool.execute(
        `INSERT INTO smm_instances (order_id, domain, folder_name, folder_path, site_url, customer_email, status, supabase_project_ref, supabase_project_response, supabase_user_email, admin_password_encrypted)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        [order.id, order.domain || siteUrl.replace(/^https?:\/\//, '').split('/')[0], folderName, folderPathRelative, siteUrl, order.customer_email, supabaseRef, projectResponseJson, supabaseUserEmail, adminEnc]
      );
      await pool.execute('UPDATE smm_website_orders SET smm_instance_id = ?, status = ? WHERE id = ?', [ins.insertId, 'completed', order.id]);
    });
    if (!insertOk) return res.status(200).json({ success: false, message: 'Step failed', steps: await getSteps(pool, order.id) });

    return res.status(200).json({ success: true, message: 'Provisioning completed', steps: await getSteps(pool, order.id) });
  } catch (error) {
    defaultLogger.error('SMM provision retry error:', error);
    res.status(500).json({ error: error.message || 'Internal error' });
  }
});

module.exports = router;
