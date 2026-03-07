/**
 * Cloudflare DNS helper for SMM: create DNS record when user selects a subdomain.
 * Configure in admin panel (cloudflare_config table).
 */

const axios = require('axios');
const { defaultLogger } = require('./logger');

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Get Cloudflare config from DB. Returns null if disabled or missing.
 */
async function getCloudflareConfig(pool) {
  const [rows] = await pool.execute(
    'SELECT is_enabled, api_token, zone_id, base_domain, record_type, target_value, proxied FROM cloudflare_config WHERE id = 1'
  );
  if (!rows.length || !rows[0].is_enabled || !rows[0].api_token || !rows[0].zone_id) {
    return null;
  }
  const r = rows[0];
  const target = (r.target_value || '').trim();
  if (!target) return null;
  return {
    apiToken: r.api_token,
    zoneId: r.zone_id,
    baseDomain: (r.base_domain || '').trim().replace(/^https?:\/\//, '').split('/')[0],
    recordType: r.record_type === 'A' ? 'A' : 'CNAME',
    targetValue: target,
    proxied: !!r.proxied,
  };
}

/**
 * Create a DNS record in Cloudflare for the given name (e.g. yourname.fivedit.com).
 * Uses config from DB. Returns { success: true, result } or throws.
 */
async function createDnsRecord(pool, recordName) {
  const config = await getCloudflareConfig(pool);
  if (!config) {
    defaultLogger.log('Cloudflare DNS: skipped (not configured or disabled)');
    return null;
  }
  const name = recordName.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  if (!name) throw new Error('Invalid record name');

  const payload = {
    type: config.recordType,
    name,
    content: config.targetValue,
    ttl: 1, // 1 = auto
    proxied: config.proxied,
  };

  const url = `${CF_API_BASE}/zones/${config.zoneId}/dns_records`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  if (!res.data || !res.data.success) {
    const errMsg = (res.data && res.data.errors && res.data.errors[0] && res.data.errors[0].message) || res.statusText;
    throw new Error(errMsg || 'Cloudflare API error');
  }
  defaultLogger.log('Cloudflare DNS: created record', name, config.recordType, '->', config.targetValue);
  return res.data;
}

module.exports = {
  getCloudflareConfig,
  createDnsRecord,
};
