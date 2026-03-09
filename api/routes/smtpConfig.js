/**
 * SMTP configuration for outgoing email. Stored in DB; password encrypted.
 * Admin: GET (password masked) / PUT. Email utility reads from DB (with .env fallback).
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { encryptPassword, decryptPassword } = require('../utils/encryption');
const { defaultLogger } = require('../utils/logger');

const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled, host, port, secure, user, password_encrypted, from_address, cc_addresses, require_tls FROM smtp_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        is_enabled: false,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        password: '', // never send real password to client
        from_address: '',
        cc_addresses: '',
        require_tls: true,
      });
    }
    const r = rows[0];
    res.json({
      is_enabled: Boolean(r.is_enabled),
      host: r.host || 'smtp.gmail.com',
      port: r.port != null ? Number(r.port) : 587,
      secure: Boolean(r.secure),
      user: r.user || '',
      password: r.password_encrypted ? '********' : '', // masked
      from_address: r.from_address || '',
      cc_addresses: r.cc_addresses ? String(r.cc_addresses).trim() : '',
      require_tls: r.require_tls !== false,
    });
  } catch (e) {
    defaultLogger.error('SMTP config admin get', e);
    res.status(500).json({ error: 'Failed to load SMTP config' });
  }
});

adminRouter.put('/', async (req, res) => {
  try {
    let {
      is_enabled,
      host,
      port,
      secure,
      user,
      password,
      from_address,
      cc_addresses,
      require_tls,
    } = req.body;

    const portNum = port != null ? parseInt(port, 10) : 587;
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ error: 'Invalid port' });
    }

    const [existing] = await pool.execute('SELECT id, password_encrypted FROM smtp_config WHERE id = 1');
    let passwordToStore = null;
    if (password !== undefined && password !== '' && password !== '********') {
      passwordToStore = encryptPassword(password);
    } else if (existing.length > 0 && existing[0].password_encrypted) {
      passwordToStore = existing[0].password_encrypted; // keep existing
    }

    const ccValue = (cc_addresses && String(cc_addresses).trim()) ? String(cc_addresses).trim() : null;
    await pool.execute(
      `INSERT INTO smtp_config (id, is_enabled, host, port, secure, user, password_encrypted, from_address, cc_addresses, require_tls, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         host = VALUES(host),
         port = VALUES(port),
         secure = VALUES(secure),
         user = VALUES(user),
         password_encrypted = COALESCE(VALUES(password_encrypted), password_encrypted),
         from_address = VALUES(from_address),
         cc_addresses = VALUES(cc_addresses),
         require_tls = VALUES(require_tls),
         updated_at = CURRENT_TIMESTAMP`,
      [
        Boolean(is_enabled),
        (host || 'smtp.gmail.com').trim(),
        portNum,
        Boolean(secure),
        (user || '').trim() || null,
        passwordToStore,
        (from_address || '').trim() || null,
        ccValue,
        require_tls !== false,
      ]
    );

    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('SMTP config admin put', e);
    res.status(500).json({ error: 'Failed to save SMTP config' });
  }
});

router.adminRouter = adminRouter;
module.exports = router;
