const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Test route
router.get('/', (req, res) => {
  res.json({ message: 'Hosting packages API is working', path: req.path });
});

// Public route - Get all active hosting packages
router.get('/packages', async (req, res) => {
  try {
    console.log('[HOSTING PACKAGES] GET /packages - Fetching active packages');
    console.log('[HOSTING PACKAGES] Request headers:', req.headers);
    
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE is_active = TRUE ORDER BY price_monthly ASC'
    );
    
    console.log(`[HOSTING PACKAGES] Found ${packages.length} packages`);
    
    // Normalize boolean values for JSON response
    const normalizedPackages = packages.map(pkg => ({
      ...pkg,
      ssl_included: pkg.ssl_included === 1 || pkg.ssl_included === true,
      cpanel: pkg.cpanel === 1 || pkg.cpanel === true,
      wordpress: pkg.wordpress === 1 || pkg.wordpress === true,
      nodejs: pkg.nodejs === 1 || pkg.nodejs === true,
      python: pkg.python === 1 || pkg.python === true,
      popular: pkg.popular === 1 || pkg.popular === true,
      is_active: pkg.is_active === 1 || pkg.is_active === true,
    }));
    
    res.json({ packages: normalizedPackages });
  } catch (error) {
    console.error('[HOSTING PACKAGES] Error fetching hosting packages:', error);
    console.error('[HOSTING PACKAGES] Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: 'Failed to fetch hosting packages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Public route - Get single package by ID
router.get('/packages/:id', async (req, res) => {
  try {
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );
    if (packages.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ package: packages[0] });
  } catch (error) {
    console.error('Error fetching hosting package:', error);
    res.status(500).json({ error: 'Failed to fetch hosting package' });
  }
});

// Admin routes - require authentication
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

// Get all packages (admin)
adminRouter.get('/packages', async (req, res) => {
  try {
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages ORDER BY price_monthly ASC'
    );
    res.json({ packages });
  } catch (error) {
    console.error('Error fetching hosting packages:', error);
    res.status(500).json({ error: 'Failed to fetch hosting packages' });
  }
});

// Get single package (admin)
adminRouter.get('/packages/:id', async (req, res) => {
  try {
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ?',
      [req.params.id]
    );
    if (packages.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ package: packages[0] });
  } catch (error) {
    console.error('Error fetching hosting package:', error);
    res.status(500).json({ error: 'Failed to fetch hosting package' });
  }
});

// Create package (admin)
adminRouter.post('/packages', async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      currency = 'BDT',
      disk_space_gb,
      bandwidth_gb,
      domains,
      email_accounts,
      databases,
      ssl_included = true,
      backups,
      support_type,
      cpanel = true,
      wordpress = false,
      php_version,
      nodejs = false,
      python = false,
      popular = false,
      is_active = true,
    } = req.body;

    if (!name || !display_name || !price_monthly || !price_yearly || !disk_space_gb) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      `INSERT INTO hosting_packages (
        name, display_name, description, price_monthly, price_yearly, currency,
        disk_space_gb, bandwidth_gb, domains, email_accounts, \`databases\`,
        ssl_included, backups, support_type, cpanel, wordpress, php_version,
        nodejs, python, popular, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        display_name,
        description || null,
        price_monthly,
        price_yearly,
        currency,
        disk_space_gb,
        bandwidth_gb || null,
        domains || null,
        email_accounts || null,
        databases || null,
        ssl_included,
        backups || null,
        support_type || null,
        cpanel,
        wordpress,
        php_version || null,
        nodejs,
        python,
        popular,
        is_active,
      ]
    );

    const [newPackage] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ package: newPackage[0] });
  } catch (error) {
    console.error('Error creating hosting package:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Package name already exists' });
    }
    res.status(500).json({ error: 'Failed to create hosting package' });
  }
});

// Update package (admin)
adminRouter.put('/packages/:id', async (req, res) => {
  try {
    const {
      display_name,
      description,
      price_monthly,
      price_yearly,
      currency,
      disk_space_gb,
      bandwidth_gb,
      domains,
      email_accounts,
      databases,
      ssl_included,
      backups,
      support_type,
      cpanel,
      wordpress,
      php_version,
      nodejs,
      python,
      popular,
      is_active,
    } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM hosting_packages WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    await pool.execute(
      `UPDATE hosting_packages SET
        display_name = COALESCE(?, display_name),
        description = COALESCE(?, description),
        price_monthly = COALESCE(?, price_monthly),
        price_yearly = COALESCE(?, price_yearly),
        currency = COALESCE(?, currency),
        disk_space_gb = COALESCE(?, disk_space_gb),
        bandwidth_gb = ?,
        domains = ?,
        email_accounts = ?,
        \`databases\` = ?,
        ssl_included = COALESCE(?, ssl_included),
        backups = ?,
        support_type = ?,
        cpanel = COALESCE(?, cpanel),
        wordpress = COALESCE(?, wordpress),
        php_version = ?,
        nodejs = COALESCE(?, nodejs),
        python = COALESCE(?, python),
        popular = COALESCE(?, popular),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        display_name,
        description,
        price_monthly,
        price_yearly,
        currency,
        disk_space_gb,
        bandwidth_gb,
        domains,
        email_accounts,
        databases,
        ssl_included,
        backups,
        support_type,
        cpanel,
        wordpress,
        php_version,
        nodejs,
        python,
        popular,
        is_active,
        req.params.id,
      ]
    );

    const [updated] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ?',
      [req.params.id]
    );

    res.json({ package: updated[0] });
  } catch (error) {
    console.error('Error updating hosting package:', error);
    res.status(500).json({ error: 'Failed to update hosting package' });
  }
});

// Delete package (admin)
adminRouter.delete('/packages/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM hosting_packages WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Check if package is used in any orders
    const [orders] = await pool.execute(
      'SELECT COUNT(*) as count FROM hosting_orders WHERE package_id = ?',
      [req.params.id]
    );

    if (orders[0].count > 0) {
      // Soft delete - set is_active to false
      await pool.execute(
        'UPDATE hosting_packages SET is_active = FALSE WHERE id = ?',
        [req.params.id]
      );
      res.json({ message: 'Package deactivated (has existing orders)' });
    } else {
      // Hard delete
      await pool.execute('DELETE FROM hosting_packages WHERE id = ?', [req.params.id]);
      res.json({ message: 'Package deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting hosting package:', error);
    res.status(500).json({ error: 'Failed to delete hosting package' });
  }
});

module.exports = { public: router, admin: adminRouter };

