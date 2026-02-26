const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { defaultLogger } = require('../utils/logger');

// Customer registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT id FROM customer_users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO customer_users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, phone || null]
    );

    if (!process.env.JWT_SECRET) {
      defaultLogger.error('JWT_SECRET is not configured');
      return res.status(500).json({ error: 'Authentication is not configured' });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: result.insertId,
        email: email,
        role: 'customer',
        name: name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // Longer expiry for customers
    );

    defaultLogger.log(`✅ New customer registered: ${email}`);

    res.json({
      token,
      user: {
        id: result.insertId,
        name: name,
        email: email,
        phone: phone,
        role: 'customer',
      },
    });
  } catch (error) {
    defaultLogger.error('Customer registration error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Customer login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await pool.execute(
      'SELECT id, name, email, password_hash, phone FROM customer_users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!process.env.JWT_SECRET) {
      defaultLogger.error('JWT_SECRET is not configured');
      return res.status(500).json({ error: 'Authentication is not configured' });
    }

    // Update last login
    await pool.execute(
      'UPDATE customer_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'customer',
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'customer',
      },
    });
  } catch (error) {
    defaultLogger.error('Customer login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// One-time login after SMM purchase: exchange order token for customer JWT
router.post('/guest-login', async (req, res) => {
  try {
    const { token, order_id } = req.body;
    if (!token || !order_id) {
      return res.status(400).json({ error: 'token and order_id required' });
    }

    const [orders] = await pool.execute(
      `SELECT id, customer_email, customer_name, one_time_login_token, one_time_login_expires_at
       FROM smm_website_orders WHERE order_id = ? LIMIT 1`,
      [order_id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    if (order.one_time_login_token !== token) return res.status(401).json({ error: 'Invalid token' });
    if (!order.one_time_login_expires_at || new Date(order.one_time_login_expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Token expired' });
    }

    await pool.execute(
      'UPDATE smm_website_orders SET one_time_login_token = NULL, one_time_login_expires_at = NULL WHERE id = ?',
      [order.id]
    );

    let [users] = await pool.execute(
      'SELECT id, name, email, phone FROM customer_users WHERE email = ? LIMIT 1',
      [order.customer_email]
    );
    if (users.length === 0) {
      await pool.execute(
        'INSERT INTO customer_users (email, password_hash, name) VALUES (?, ?, ?)',
        [order.customer_email, await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10), order.customer_name || order.customer_email]
      );
      const [newUsers] = await pool.execute(
        'SELECT id, name, email, phone FROM customer_users WHERE email = ? LIMIT 1',
        [order.customer_email]
      );
      users = newUsers;
    }
    const user = users[0];
    if (!user) return res.status(500).json({ error: 'Failed to create session' });

    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Authentication not configured' });
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: 'customer', name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token: jwtToken,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: 'customer' },
    });
  } catch (error) {
    defaultLogger.error('Customer guest-login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;


