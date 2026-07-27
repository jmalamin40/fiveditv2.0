const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

// All routes require authentication
router.use(authenticate);

// Middleware to check if user is a customer
function requireCustomer(req, res, next) {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Access denied. Customer access required.' });
  }
  next();
}

router.use(requireCustomer);

// Get customer's orders
router.get('/orders', async (req, res) => {
  try {
    const customerId = req.user.id;
    const customerEmail = req.user.email;

    const [orders] = await pool.execute(
      `SELECT 
        ho.order_id,
        ho.transaction_id,
        ho.status,
        ho.amount,
        ho.currency,
        ho.billing_period,
        ho.package_name,
        ho.domain,
        ho.username,
        ho.created_at,
        ho.paid_at,
        ho.hosting_account_id,
        hp.display_name as package_display_name,
        ha.status as account_status,
        ha.disk_used,
        ha.disk_limit,
        ha.bandwidth_used,
        ha.bandwidth_limit
      FROM hosting_orders ho
      LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
      LEFT JOIN hosting_accounts ha ON ho.hosting_account_id = ha.id
      WHERE (ho.customer_id = ? OR ho.customer_email = ?)
      ORDER BY ho.created_at DESC`,
      [customerId, customerEmail]
    );

    // Normalize status - if order is completed and has account, show account status, otherwise show order status
    const normalizedOrders = orders.map(order => {
      // If order is completed and has hosting account, use account status
      if (order.status === 'completed' && order.hosting_account_id && order.account_status) {
        return {
          ...order,
          display_status: order.account_status, // Use account status for display
        };
      }
      // Otherwise use order status
      return {
        ...order,
        display_status: order.status,
      };
    });

    res.json({ orders: normalizedOrders });
  } catch (error) {
    defaultLogger.error('Error fetching customer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get customer's enrolled courses
router.get('/courses', async (req, res) => {
  try {
    const customerId = req.user.id;

    const [enrollments] = await pool.execute(
      `SELECT
        ce.id AS enrollment_id,
        ce.enrolled_at,
        c.id AS course_id,
        c.title,
        c.thumbnail,
        c.instructor_name,
        c.level,
        co.order_id,
        co.amount,
        co.currency,
        co.paid_at
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      LEFT JOIN course_orders co ON co.id = ce.order_id
      WHERE ce.customer_id = ?
      ORDER BY ce.enrolled_at DESC`,
      [customerId]
    );

    res.json({ courses: enrollments });
  } catch (error) {
    defaultLogger.error('Error fetching customer courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get customer's hosting accounts
router.get('/accounts', async (req, res) => {
  try {
    const customerId = req.user.id;
    const customerEmail = req.user.email;

    // Get accounts from hosting_accounts table (linked by email)
    // Also get accounts from orders that have been paid/completed
    const [accounts] = await pool.execute(
      `SELECT DISTINCT
        ha.id,
        ha.domain,
        ha.username,
        ha.package_name,
        ha.status,
        ha.disk_used,
        ha.disk_limit,
        ha.bandwidth_used,
        ha.bandwidth_limit,
        ha.ip_address,
        ha.created_at,
        ha.expires_at,
        ho.order_id,
        ho.billing_period,
        ho.amount,
        ho.currency,
        ho.paid_at,
        ho.status as order_status,
        hp.display_name as package_display_name
      FROM hosting_accounts ha
      LEFT JOIN hosting_orders ho ON ha.id = ho.hosting_account_id
      LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
      WHERE ha.customer_email = ?
        AND (ho.status IN ('paid', 'completed') OR ho.status IS NULL)
      ORDER BY ha.created_at DESC`,
      [customerEmail]
    );

    // Also get accounts from orders that are paid but don't have hosting_accounts yet
    const [orderAccounts] = await pool.execute(
      `SELECT 
        NULL as id,
        ho.domain,
        ho.username,
        ho.package_name,
        CASE 
          WHEN ho.status = 'completed' THEN 'active'
          WHEN ho.status = 'paid' THEN 'pending'
          ELSE ho.status
        END as status,
        0 as disk_used,
        0 as disk_limit,
        0 as bandwidth_used,
        0 as bandwidth_limit,
        NULL as ip_address,
        ho.created_at,
        NULL as expires_at,
        ho.order_id,
        ho.billing_period,
        ho.amount,
        ho.currency,
        ho.paid_at,
        ho.status as order_status,
        hp.display_name as package_display_name
      FROM hosting_orders ho
      LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
      WHERE (ho.customer_id = ? OR ho.customer_email = ?)
        AND ho.status IN ('paid', 'completed')
        AND ho.hosting_account_id IS NULL
      ORDER BY ho.created_at DESC`,
      [customerId || 0, customerEmail]
    );

    // Combine and deduplicate
    const allAccounts = [...accounts, ...orderAccounts];
    const uniqueAccounts = allAccounts.filter((account, index, self) =>
      index === self.findIndex(a => a.order_id === account.order_id)
    );

    // Normalize account status - if account exists in hosting_accounts, use its status
    // If it's from orders only, use appropriate status based on order status
    const normalizedAccounts = uniqueAccounts.map(account => {
      if (account.id) {
        // Account exists in hosting_accounts table
        return {
          ...account,
          display_status: account.status || 'active', // Default to active if null
        };
      } else {
        // Account only exists in orders (not yet created in DirectAdmin)
        return {
          ...account,
          display_status: account.status || (account.order_status === 'completed' ? 'active' : 'pending'),
        };
      }
    });

    res.json({ accounts: normalizedAccounts });
  } catch (error) {
    defaultLogger.error('Error fetching customer accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get single order details
router.get('/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const customerEmail = req.user.email;

    const [orders] = await pool.execute(
      `SELECT 
        ho.*,
        hp.display_name as package_display_name,
        ha.id as account_id,
        ha.status as account_status,
        ha.disk_used,
        ha.disk_limit,
        ha.bandwidth_used,
        ha.bandwidth_limit
      FROM hosting_orders ho
      LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
      LEFT JOIN hosting_accounts ha ON ho.hosting_account_id = ha.id
      WHERE ho.order_id = ? AND ho.customer_email = ?`,
      [order_id, customerEmail]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: orders[0] });
  } catch (error) {
    defaultLogger.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get customer profile
router.get('/profile', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, created_at, last_login FROM customer_users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    defaultLogger.error('Error fetching customer profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update customer profile
router.put('/profile', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await pool.execute(
      'UPDATE customer_users SET name = ?, phone = ? WHERE id = ?',
      [name, phone || null, req.user.id]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    defaultLogger.error('Error updating customer profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get customer's SMM website orders
router.get('/smm-orders', async (req, res) => {
  try {
    const customerId = req.user.id;
    const customerEmail = req.user.email;

    const [orders] = await pool.execute(
      `SELECT 
        o.order_id,
        o.transaction_id,
        o.status,
        o.amount,
        o.currency,
        o.domain,
        o.subdomain_slug,
        o.created_at,
        o.paid_at,
        o.smm_instance_id,
        p.display_name as product_display_name
      FROM smm_website_orders o
      LEFT JOIN smm_website_products p ON o.product_id = p.id
      WHERE o.customer_id = ? OR o.customer_email = ?
      ORDER BY o.created_at DESC`,
      [customerId, customerEmail]
    );

    res.json({ orders });
  } catch (error) {
    defaultLogger.error('Error fetching customer SMM orders:', error);
    res.status(500).json({ error: 'Failed to fetch SMM orders' });
  }
});

// Get customer's SMM instances (provisioned websites)
router.get('/smm-instances', async (req, res) => {
  try {
    const customerEmail = req.user.email;

    const [instances] = await pool.execute(
      `SELECT 
        i.id,
        i.domain,
        i.folder_name,
        i.folder_path,
        i.site_url,
        i.status,
        i.created_at,
        o.order_id,
        o.amount,
        o.currency,
        p.display_name as product_display_name
      FROM smm_instances i
      INNER JOIN smm_website_orders o ON i.order_id = o.id
      LEFT JOIN smm_website_products p ON o.product_id = p.id
      WHERE i.customer_email = ? AND o.status IN ('paid', 'completed')
      ORDER BY i.created_at DESC`,
      [customerEmail]
    );

    res.json({ instances });
  } catch (error) {
    defaultLogger.error('Error fetching customer SMM instances:', error);
    res.status(500).json({ error: 'Failed to fetch SMM instances' });
  }
});

module.exports = router;


