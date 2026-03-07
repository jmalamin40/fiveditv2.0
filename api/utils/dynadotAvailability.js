/**
 * Domain availability check via Dynadot RESTful API v2.
 * Legacy api3.json?command=search is deprecated; we use GET /restful/v2/domains/{domain}/search.
 * Base URL: https://api.dynadot.com or https://api-sandbox.dynadot.com for sandbox.
 */

const axios = require('axios');

const DEFAULT_BASE = 'https://api.dynadot.com';

function errorMessageToString(msg) {
  if (msg == null) return '';
  if (typeof msg === 'string') return msg.trim();
  if (typeof msg === 'object') {
    if (msg.message) return String(msg.message);
    if (msg.description) return String(msg.description);
    try { return JSON.stringify(msg); } catch (_) { return String(msg); }
  }
  return String(msg);
}

/**
 * Check domain availability using Dynadot RESTful API v2.
 * GET /restful/v2/domains/{domain_name}/search
 * @param {string} domainName - e.g. example.com
 * @param {string} apiKey - Dynadot API key (Production or Sandbox)
 * @param {string} [apiUrl] - optional base URL (e.g. https://api-sandbox.dynadot.com)
 * @returns {Promise<{ available: boolean, domain: string }>}
 */
async function checkDynadotAvailability(domainName, apiKey, apiUrl) {
  if (!domainName || !apiKey) {
    throw new Error('Domain name and API key are required');
  }
  const domain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!domain || !domain.includes('.')) {
    throw new Error('Invalid domain name');
  }

  let base = (apiUrl || DEFAULT_BASE).trim() || DEFAULT_BASE;
  base = base.replace(/\/restful.*$/i, '').replace(/\/?$/, '');
  if (!base.startsWith('http')) base = 'https://' + base.replace(/^\/+/, '');
  const path = `/restful/v2/domains/${encodeURIComponent(domain)}/search`;
  const url = base + path;

  let data;
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    data = res.data;
    if (res.status !== 200 && res.status !== 201) {
      const raw = data && (data.message || data.error || data.Message || (data.error && data.error.description));
      const msg = errorMessageToString(raw || data);
      throw new Error(msg ? `Dynadot API HTTP ${res.status}: ${msg}` : `Dynadot API request failed (HTTP ${res.status})`);
    }
  } catch (err) {
    if (err.response !== undefined) throw err;
    const msg = err.message || err.code || String(err);
    throw new Error(msg ? `Dynadot request failed: ${msg}` : 'Dynadot API request failed (network or timeout)');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Dynadot API returned empty or invalid response');
  }

  const code = data.Code ?? data.code;
  if (code !== 200 && code !== 201 && code !== '200' && code !== '201') {
    const raw = data.Message ?? data.message ?? data.error ?? data.Error;
    const errMsg = errorMessageToString(raw);
    throw new Error(errMsg ? `Dynadot: ${errMsg}` : `Dynadot API error (code ${code})`);
  }

  const payload = data.Data ?? data.data ?? data;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Dynadot API response missing Data');
  }

  const available = String(payload.Available ?? payload.available ?? payload.result ?? '').toLowerCase() === 'yes';
  const name = (payload.DomainName ?? payload.domain_name ?? payload.domain ?? domain).toLowerCase();
  return { available, domain: name };
}

module.exports = { checkDynadotAvailability };
