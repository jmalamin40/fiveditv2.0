/**
 * Facebook Pixel and Conversations API config.
 * Admin: GET/PUT full config. Public: GET pixel_id + pixel_enabled only (for frontend script).
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

// GET /api/facebook-config – public, returns only pixel fields for frontend injection (no auth)
router.get('/public', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT pixel_enabled, pixel_id FROM facebook_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({ pixel_enabled: false, pixel_id: null });
    }
    const r = rows[0];
    res.json({
      pixel_enabled: Boolean(r.pixel_enabled),
      pixel_id: r.pixel_id ? String(r.pixel_id).trim() : null,
    });
  } catch (e) {
    defaultLogger.error('Facebook config public get', e);
    res.status(500).json({ pixel_enabled: false, pixel_id: null });
  }
});

// Admin routes below
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT pixel_enabled, pixel_id, pixel_access_token, conv_api_enabled, page_id, page_access_token FROM facebook_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        pixel_enabled: false,
        pixel_id: '',
        pixel_access_token: '',
        conv_api_enabled: false,
        page_id: '',
        page_access_token: '',
      });
    }
    const r = rows[0];
    res.json({
      pixel_enabled: Boolean(r.pixel_enabled),
      pixel_id: r.pixel_id || '',
      pixel_access_token: r.pixel_access_token || '',
      conv_api_enabled: Boolean(r.conv_api_enabled),
      page_id: r.page_id || '',
      page_access_token: r.page_access_token || '',
    });
  } catch (e) {
    defaultLogger.error('Facebook config admin get', e);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

adminRouter.put('/', async (req, res) => {
  try {
    const {
      pixel_enabled,
      pixel_id,
      pixel_access_token,
      conv_api_enabled,
      page_id,
      page_access_token,
    } = req.body;
    await pool.execute(
      `INSERT INTO facebook_config (id, pixel_enabled, pixel_id, pixel_access_token, conv_api_enabled, page_id, page_access_token)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pixel_enabled = VALUES(pixel_enabled),
         pixel_id = VALUES(pixel_id),
         pixel_access_token = VALUES(pixel_access_token),
         conv_api_enabled = VALUES(conv_api_enabled),
         page_id = VALUES(page_id),
         page_access_token = VALUES(page_access_token),
         updated_at = CURRENT_TIMESTAMP`,
      [
        Boolean(pixel_enabled),
        (pixel_id || '').trim() || null,
        (pixel_access_token || '').trim() || null,
        Boolean(conv_api_enabled),
        (page_id || '').trim() || null,
        (page_access_token || '').trim() || null,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('Facebook config admin put', e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

module.exports = router;
module.exports.adminRouter = adminRouter;
