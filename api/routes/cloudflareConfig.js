const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET cloudflare config (admin)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled, api_token, zone_id, base_domain, record_type, target_value, proxied FROM cloudflare_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        is_enabled: false,
        api_token: '',
        zone_id: '',
        base_domain: '',
        record_type: 'CNAME',
        target_value: '',
        proxied: true,
      });
    }
    const r = rows[0];
    res.json({
      is_enabled: !!r.is_enabled,
      api_token: r.api_token || '',
      zone_id: r.zone_id || '',
      base_domain: r.base_domain || '',
      record_type: r.record_type || 'CNAME',
      target_value: r.target_value || '',
      proxied: !!r.proxied,
    });
  } catch (error) {
    console.error('Error fetching Cloudflare config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// PUT cloudflare config (admin)
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { is_enabled, api_token, zone_id, base_domain, record_type, target_value, proxied } = req.body;
    const recordType = record_type === 'A' ? 'A' : 'CNAME';
    await pool.execute(
      `INSERT INTO cloudflare_config (id, is_enabled, api_token, zone_id, base_domain, record_type, target_value, proxied)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         api_token = VALUES(api_token),
         zone_id = VALUES(zone_id),
         base_domain = VALUES(base_domain),
         record_type = VALUES(record_type),
         target_value = VALUES(target_value),
         proxied = VALUES(proxied)`,
      [!!is_enabled, api_token || null, zone_id || null, (base_domain || '').trim() || null, recordType, (target_value || '').trim() || null, !!proxied]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating Cloudflare config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

module.exports = router;
