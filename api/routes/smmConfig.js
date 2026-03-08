/**
 * SMM Website Configuration: configurable price (default 4999) for the one-time "SMM Website Configuration" service.
 * Public: GET price, currency, product_id. Admin: GET/PUT full config; on save, sync price to the config product row.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

const CONFIG_PRODUCT_NAME = 'smm-website-configuration';

// GET /api/smm/config – public, returns price, currency, product_id for SMM Website Configuration
router.get('/config', async (req, res) => {
  try {
    const [configRows] = await pool.execute(
      'SELECT website_configuration_price, website_configuration_currency FROM smm_config WHERE id = 1'
    );
    const [productRows] = await pool.execute(
      'SELECT id FROM smm_website_products WHERE name = ? AND is_active = TRUE LIMIT 1',
      [CONFIG_PRODUCT_NAME]
    );
    const price = configRows.length ? Number(configRows[0].website_configuration_price) : 4999;
    const currency = configRows.length ? (configRows[0].website_configuration_currency || 'BDT') : 'BDT';
    const product_id = productRows.length ? productRows[0].id : null;
    res.json({
      website_configuration_price: price,
      website_configuration_currency: currency,
      website_configuration_product_id: product_id,
    });
  } catch (e) {
    defaultLogger.error('SMM config public get', e);
    res.status(500).json({
      website_configuration_price: 4999,
      website_configuration_currency: 'BDT',
      website_configuration_product_id: null,
    });
  }
});

const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT website_configuration_price, website_configuration_currency FROM smm_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        website_configuration_price: 4999,
        website_configuration_currency: 'BDT',
      });
    }
    const r = rows[0];
    res.json({
      website_configuration_price: Number(r.website_configuration_price),
      website_configuration_currency: r.website_configuration_currency || 'BDT',
    });
  } catch (e) {
    defaultLogger.error('SMM config admin get', e);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

adminRouter.put('/', async (req, res) => {
  try {
    let { website_configuration_price, website_configuration_currency } = req.body;
    const price = Number(website_configuration_price);
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    const currency = (website_configuration_currency || 'BDT').toString().trim().toUpperCase() || 'BDT';

    await pool.execute(
      `INSERT INTO smm_config (id, website_configuration_price, website_configuration_currency)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE
         website_configuration_price = VALUES(website_configuration_price),
         website_configuration_currency = VALUES(website_configuration_currency),
         updated_at = CURRENT_TIMESTAMP`,
      [price, currency]
    );

    await pool.execute(
      'UPDATE smm_website_products SET price = ?, currency = ? WHERE name = ?',
      [price, currency, CONFIG_PRODUCT_NAME]
    );

    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('SMM config admin put', e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

router.adminRouter = adminRouter;
module.exports = router;
