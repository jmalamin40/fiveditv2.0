/**
 * Admin routes: domain reseller config and TLD pricing CRUD.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getDomainResellerConfig } = require('../utils/domainConfig');
const { defaultLogger } = require('../utils/logger');

router.use(authenticate, requireAdmin);

// GET /api/admin/domain/config – reseller config (single row id=1)
router.get('/config', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM domain_reseller_config WHERE id = 1');
    const row = rows[0] || null;
    if (!row) {
      return res.json({
        id: 1,
        is_enabled: false,
        provider: null,
        api_url: null,
        api_key: null,
        api_secret: null,
        reseller_customer_id: null,
        default_currency: 'BDT',
        use_sandbox: false,
        updated_at: null,
      });
    }
    res.json({
      id: row.id,
      is_enabled: Boolean(row.is_enabled),
      provider: row.provider,
      api_url: row.api_url,
      api_key: row.api_key,
      api_secret: row.api_secret,
      reseller_customer_id: row.reseller_customer_id,
      default_currency: row.default_currency || 'BDT',
      use_sandbox: Boolean(row.use_sandbox),
      updated_at: row.updated_at,
    });
  } catch (e) {
    defaultLogger.error('Domain admin config get', e);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// PUT /api/admin/domain/config – update reseller config
router.put('/config', async (req, res) => {
  try {
    const {
      is_enabled,
      provider,
      api_url,
      api_key,
      api_secret,
      reseller_customer_id,
      default_currency,
      use_sandbox,
    } = req.body;
    await pool.execute(
      `INSERT INTO domain_reseller_config (id, is_enabled, provider, api_url, api_key, api_secret, reseller_customer_id, default_currency, use_sandbox)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         provider = VALUES(provider),
         api_url = VALUES(api_url),
         api_key = VALUES(api_key),
         api_secret = VALUES(api_secret),
         reseller_customer_id = VALUES(reseller_customer_id),
         default_currency = VALUES(default_currency),
         use_sandbox = VALUES(use_sandbox),
         updated_at = CURRENT_TIMESTAMP`,
      [
        is_enabled !== undefined ? Boolean(is_enabled) : false,
        provider || null,
        api_url || null,
        api_key || null,
        api_secret || null,
        reseller_customer_id || null,
        default_currency || 'BDT',
        use_sandbox !== undefined ? Boolean(use_sandbox) : false,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('Domain admin config put', e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// GET /api/admin/domain/dynadot-tld-prices – fetch actual cost prices from Dynadot (Legacy tld_price API)
router.get('/dynadot-tld-prices', async (req, res) => {
  try {
    const config = await getDomainResellerConfig();
    if (!config || (config.provider || '').toLowerCase() !== 'dynadot' || !config.api_key) {
      return res.status(400).json({ error: 'Dynadot is not configured. Set provider to Dynadot and save your API key in Domain sales config.' });
    }
    let base = (config.api_url || 'https://api.dynadot.com').trim().replace(/\/restful.*$/i, '').replace(/\/?$/, '');
    if (!base.startsWith('http')) base = 'https://' + base;
    // Dynadot docs: currency should be "usd", "eur", or "cny" (lowercase)
    const currencyParam = (req.query.currency || 'usd').toString().toLowerCase();
    const currencyDisplay = currencyParam.toUpperCase();
    const url = `${base}/api3.json?key=${encodeURIComponent(config.api_key)}&command=tld_price&currency=${encodeURIComponent(currencyParam)}`;
    const axRes = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
    });
    let data = axRes.data;
    // If Dynadot returns XML (e.g. api3.json still returns XML on error), parse error from it
    if (typeof data === 'string') {
      const raw = data.trim();
      if (raw.startsWith('<')) {
        const tag = raw.match(/<ErrorMessage[^>]*>([^<]*)<\/ErrorMessage>/i) || raw.match(/<Error[^>]*>([^<]*)<\/Error>/i);
        const errText = tag ? tag[1].trim() : null;
        if (errText) return res.status(400).json({ error: errText });
        if (/not recognized|deprecated|invalid|unknown command/i.test(raw)) {
          return res.status(400).json({
            error: 'Legacy API (api3) command not allowed for this key. In Dynadot: Tools → API → unlock Legacy API, or use a Sandbox key with API URL https://api-sandbox.dynadot.com',
          });
        }
        return res.status(400).json({
          error: 'Dynadot returned XML. Use Legacy API key (dynadot.com → Tools → API) or try Sandbox: API URL https://api-sandbox.dynadot.com with a Sandbox key.',
        });
      }
      try { data = JSON.parse(data); } catch (_) {
        return res.status(502).json({ error: 'Dynadot returned invalid response' });
      }
    }
    if (axRes.status !== 200) {
      return res.status(502).json({ error: `Dynadot API returned HTTP ${axRes.status}` });
    }
    if (!data || typeof data !== 'object') {
      defaultLogger.error('Dynadot tld_price: non-JSON or empty response', { status: axRes.status });
      return res.status(502).json({ error: 'Dynadot API returned empty or invalid response' });
    }
    // Top-level error (e.g. invalid key, or from XML transform)
    const topError = data.error || data.ErrorMessage || data.Message || data.message;
    if (topError) {
      return res.status(400).json({ error: String(topError) });
    }
    if (data.ResponseCode != null && Number(data.ResponseCode) !== 0 && data.ErrorMessage) {
      return res.status(400).json({ error: String(data.ErrorMessage) });
    }
    // TldPriceResponse may be under different casing or single root key
    let resp = data.TldPriceResponse || data.tldPriceResponse;
    if (!resp && typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 1 && data[keys[0]] && typeof data[keys[0]] === 'object') resp = data[keys[0]];
    }
    if (!resp) {
      const hint = base.includes('sandbox') ? 'Sandbox key must be from api-sandbox.dynadot.com.' : 'Use Legacy API key from dynadot.com → Tools → API (unlock Legacy/API 3), or try Sandbox: set API URL to https://api-sandbox.dynadot.com and use a Sandbox key.';
      defaultLogger.error('Dynadot tld_price: unexpected format', { keys: data ? Object.keys(data) : [], sample: JSON.stringify(data).slice(0, 300) });
      return res.status(400).json({
        error: `Dynadot returned unexpected format. ${hint}`,
      });
    }
    const code = resp.ResponseCode != null ? Number(resp.ResponseCode) : null;
    const success = code === 0;
    if (!success) {
      const errMsg = resp.ErrorMessage || resp.Error || (resp.Status && resp.Status !== 'success' ? resp.Status : null) || data.error || data.message;
      defaultLogger.warn('Dynadot tld_price error response', { ResponseCode: resp.ResponseCode, Status: resp.Status, ErrorMessage: resp.ErrorMessage });
      return res.status(400).json({
        error: errMsg ? String(errMsg) : `Dynadot tld_price failed (code ${code}). Check API key has Legacy API access and try Sandbox (api-sandbox.dynadot.com) for testing.`,
      });
    }
    const list = resp.TldPrice || [];
    const tlds = (Array.isArray(list) ? list : [list]).map((t) => {
      const price = t.Price || t.price || {};
      return {
        tld: (t.Tld || t.tld || '').toLowerCase().replace(/^\./, ''),
        register: parseFloat(price.Register || price.register || 0) || 0,
        renew: parseFloat(price.Renew || price.renew || 0) || 0,
        transfer: parseFloat(price.Transfer || price.transfer || 0) || 0,
      };
    }).filter((t) => t.tld);
    res.json({
      currency: resp.Currency || currencyDisplay,
      priceLevel: resp.PriceLevel || null,
      tlds,
    });
  } catch (e) {
    defaultLogger.error('Dynadot tld_price fetch', e);
    res.status(500).json({ error: e.message || 'Failed to fetch Dynadot prices' });
  }
});

// GET /api/admin/domain/tld-pricing – list all TLDs (admin, includes inactive)
router.get('/tld-pricing', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, tld, register_price, renew_price, currency, is_active, sort_order, created_at, updated_at FROM domain_tld_pricing ORDER BY sort_order ASC, tld ASC'
    );
    res.json({
      tlds: rows.map((r) => ({
        id: r.id,
        tld: r.tld,
        register_price: Number(r.register_price),
        renew_price: Number(r.renew_price),
        currency: r.currency || 'BDT',
        is_active: Boolean(r.is_active),
        sort_order: r.sort_order,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (e) {
    defaultLogger.error('Domain admin tld-pricing list', e);
    res.status(500).json({ error: 'Failed to list TLD pricing' });
  }
});

// POST /api/admin/domain/tld-pricing – add TLD
router.post('/tld-pricing', async (req, res) => {
  try {
    const { tld, register_price, renew_price, currency, is_active, sort_order } = req.body;
    if (!tld || typeof tld !== 'string' || !tld.trim()) {
      return res.status(400).json({ error: 'tld required' });
    }
    const t = tld.trim().toLowerCase().replace(/^\./, '');
    const reg = Number(register_price);
    const ren = Number(renew_price);
    if (isNaN(reg) || reg < 0 || isNaN(ren) || ren < 0) {
      return res.status(400).json({ error: 'register_price and renew_price must be non-negative numbers' });
    }
    await pool.execute(
      `INSERT INTO domain_tld_pricing (tld, register_price, renew_price, currency, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [t, reg, ren, currency || 'BDT', is_active !== false, sort_order != null ? Number(sort_order) : 0]
    );
    const [ins] = await pool.execute('SELECT LAST_INSERT_ID() AS id');
    res.status(201).json({ success: true, id: ins[0].id });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'TLD already exists' });
    defaultLogger.error('Domain admin tld-pricing create', e);
    res.status(500).json({ error: 'Failed to add TLD' });
  }
});

// PUT /api/admin/domain/tld-pricing/:id – update TLD
router.put('/tld-pricing/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { tld, register_price, renew_price, currency, is_active, sort_order } = req.body;
    const updates = [];
    const values = [];
    if (tld !== undefined) {
      updates.push('tld = ?');
      values.push(tld.trim().toLowerCase().replace(/^\./, ''));
    }
    if (register_price !== undefined) {
      const v = Number(register_price);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'register_price must be non-negative' });
      updates.push('register_price = ?');
      values.push(v);
    }
    if (renew_price !== undefined) {
      const v = Number(renew_price);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'renew_price must be non-negative' });
      updates.push('renew_price = ?');
      values.push(v);
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      values.push(currency || 'BDT');
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(Boolean(is_active));
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(Number(sort_order));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.execute(`UPDATE domain_tld_pricing SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('Domain admin tld-pricing update', e);
    res.status(500).json({ error: 'Failed to update TLD' });
  }
});

// DELETE /api/admin/domain/tld-pricing/:id
router.delete('/tld-pricing/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const [r] = await pool.execute('DELETE FROM domain_tld_pricing WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'TLD not found' });
    res.json({ success: true });
  } catch (e) {
    defaultLogger.error('Domain admin tld-pricing delete', e);
    res.status(500).json({ error: 'Failed to delete TLD' });
  }
});

module.exports = router;
