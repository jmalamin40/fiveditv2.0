/**
 * Load domain reseller config (for availability check and order flows).
 */

const pool = require('../config/database');

async function getDomainResellerConfig() {
  const [rows] = await pool.execute('SELECT * FROM domain_reseller_config WHERE id = 1');
  const row = rows[0];
  if (!row) return null;
  const apiKey = row.api_key != null ? String(row.api_key).trim() : '';
  return {
    provider: row.provider != null ? String(row.provider).trim() : null,
    api_key: apiKey || null,
    api_url: row.api_url != null ? String(row.api_url).trim() || null : null,
    api_secret: row.api_secret,
    reseller_customer_id: row.reseller_customer_id,
    default_currency: row.default_currency || 'BDT',
  };
}

module.exports = { getDomainResellerConfig };
