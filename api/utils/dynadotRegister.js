/**
 * Register a domain with Dynadot via Legacy API (api3.json command=register).
 * Requires account balance; contacts are optional (Dynadot uses account default if omitted).
 */

const axios = require('axios');
const { getDomainResellerConfig } = require('./domainConfig');
const { defaultLogger } = require('./logger');

/**
 * Register a domain at Dynadot (Legacy API).
 * @param {string} domainName - e.g. example.com
 * @param {number} durationYears - registration period in years (default 1)
 * @param {{ apiKey?: string, apiUrl?: string, currency?: string }} options - override config
 * @returns {Promise<{ success: boolean, domain?: string, expiration?: number, error?: string }>}
 */
async function registerDomainAtDynadot(domainName, durationYears = 1, options = {}) {
  const domain = (domainName || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!domain || !domain.includes('.')) {
    return { success: false, error: 'Invalid domain name' };
  }
  //logger
  defaultLogger.log(`Domain: ${domain}`);
  defaultLogger.log(`Duration years: ${durationYears}`);
  const duration = Math.max(1, Math.min(10, Math.floor(Number(durationYears) || 1)));
  let apiKey = options.apiKey;
  let apiUrl = options.apiUrl;
  let currency = (options.currency || 'USD').toString().toUpperCase();
  if (!apiKey || !apiUrl) {
    const config = await getDomainResellerConfig();
    if (!config || (config.provider || '').toLowerCase() !== 'dynadot' || !config.api_key) {
      return { success: false, error: 'Dynadot is not configured. Set provider and API key in Domain sales.' };
    }
    apiKey = apiKey || config.api_key;
    apiUrl = apiUrl || config.api_url || 'https://api.dynadot.com';
  }
  //logger
  defaultLogger.log(`API key: ${apiKey}`);
  defaultLogger.log(`API URL: ${apiUrl}`);
  defaultLogger.log(`Currency: ${currency}`);
  let base = (apiUrl || 'https://api.dynadot.com').trim().replace(/\/restful.*$/i, '').replace(/\/?$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  const params = new URLSearchParams({
    key: apiKey,
    command: 'register',
    domain,
    duration: String(duration),
    currency: 'USD',
  });
  const url = `${base}/api3.json?${params.toString()}`;
  //logger
  defaultLogger.log(`URL: ${url}`);
  try {
    const res = await axios.get(url, { timeout: 20000, validateStatus: () => true });
    //logger
    defaultLogger.log(`Response: ${JSON.stringify(res)}`);
    const data = res.data;
    //logger
    defaultLogger.log(`Data: ${JSON.stringify(data)}`);
    if (res.status !== 200 || !data) {
      return { success: false, error: 'Dynadot API request failed' };
    }
    const resp = data.RegisterResponse || data.registerResponse;
    //logger
    defaultLogger.log(`Response: ${JSON.stringify(resp)}`);
    if (!resp) {
      const err = data.error || data.ErrorMessage || data.message;
      return { success: false, error: err ? String(err) : 'Dynadot returned unexpected format' };
    }
    const code = resp.ResponseCode != null ? Number(resp.ResponseCode) : null;
    //logger
    defaultLogger.log(`Code: ${code}`);
    if (code !== 0) {
      const err = resp.ErrorMessage || resp.Error || (resp.Status && resp.Status !== 'success' ? resp.Status : null);
      return { success: false, error: err ? String(err) : `Dynadot register failed (code ${code})` };
    }
    //logger
    defaultLogger.log(`Success: true`);
    return {
      success: true,
      domain: resp.DomainName || domain,
      expiration: resp.Expiration ? Number(resp.Expiration) : null,
    };
  } catch (e) {
    return { success: false, error: e.message || 'Dynadot register request failed' };
  }
}

/**
 * Register domain using configured provider (currently Dynadot only).
 * @param {string} domainName
 * @param {number} durationYears
 * @returns {Promise<{ success: boolean, domain?: string, error?: string }>}
 */
async function registerDomain(domainName, durationYears = 1) {
  //logger
  defaultLogger.log(`Registering domain: ${domainName}`);
  defaultLogger.log(`Duration years: ${durationYears}`);
  const config = await getDomainResellerConfig();
  defaultLogger.log(`Config: ${JSON.stringify(config)}`);
  if (!config || (config.provider || '').toLowerCase() !== 'dynadot') {
    return { success: false, error: 'No domain provider configured for registration (Dynadot required).' };
  }
  defaultLogger.log(`Dynadot provider configured`);
  return registerDomainAtDynadot(domainName, durationYears, {
    apiKey: config.api_key,
    apiUrl: config.api_url,
    currency: 'USD',
  });
}

module.exports = { registerDomain, registerDomainAtDynadot };
