/**
 * Send server-side events to Facebook (Conversions API).
 * Uses facebook_config: pixel_id, pixel_access_token or page_access_token, conv_api_enabled.
 */

const axios = require('axios');
const pool = require('../config/database');
const { defaultLogger } = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

async function getFacebookEventConfig() {
  const [rows] = await pool.execute(
    'SELECT pixel_id, pixel_access_token, conv_api_enabled, page_id, page_access_token FROM facebook_config WHERE id = 1'
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (!r.conv_api_enabled || !r.pixel_id) return null;
  const token = (r.pixel_access_token || r.page_access_token || '').trim();
  if (!token) return null;
  return {
    pixel_id: r.pixel_id,
    access_token: token,
  };
}

/**
 * Send a server-side event to Facebook Conversions API.
 * @param {string} eventName - e.g. 'Purchase', 'Lead', 'CompleteRegistration'
 * @param {object} options - { event_id?, value?, currency?, content_name?, content_ids?, content_type? }
 * @param {string} [options.userAgent] - optional
 * @param {string} [options.clientIp] - optional
 * @param {string} [options.fbc] - optional cookie
 * @param {string} [options.fbp] - optional cookie
 */
async function sendFacebookEvent(eventName, options = {}) {
  const config = await getFacebookEventConfig();
  if (!config) return;

  const {
    value,
    currency = 'USD',
    content_name,
    content_ids,
    content_type,
    event_id,
    user_agent,
    client_ip_address,
    fbc,
    fbp,
    email,
    phone,
  } = options;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: event_id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    event_source_url: options.event_source_url || undefined,
    user_data: { client_user_agent: user_agent || undefined, client_ip_address: client_ip_address || undefined, fbc: fbc || undefined, fbp: fbp || undefined, em: email || undefined, ph: phone || undefined },
    custom_data: {},
  };
  // Remove undefined keys
  event.user_data = Object.fromEntries(Object.entries(event.user_data).filter(([, v]) => v != null && v !== ''));

  if (value != null) event.custom_data.value = value;
  if (currency) event.custom_data.currency = currency;
  if (content_name) event.custom_data.content_name = content_name;
  if (content_ids) event.custom_data.content_ids = Array.isArray(content_ids) ? content_ids : [content_ids];
  if (content_type) event.custom_data.content_type = content_type;

  const url = `${GRAPH_API_BASE}/${config.pixel_id}/events`;
  const body = {
    data: [event],
    ...(options.test_event_code && { test_event_code: options.test_event_code }),
  };

  try {
    const res = await axios.post(
      `${url}?access_token=${encodeURIComponent(config.access_token)}`,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      }
    );
    if (res.status !== 200 || (res.data && res.data.error)) {
      defaultLogger.warn('Facebook CAPI event failed', eventName, res.data?.error?.message || res.status);
    }
  } catch (e) {
    defaultLogger.error('Facebook CAPI request error', e?.message || e);
  }
}

module.exports = { sendFacebookEvent, getFacebookEventConfig };
