/**
 * Public domain routes: TLD pricing, price check, and domain-only order creation.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');
const { getDomainPrice, listTldPricing } = require('../utils/domainPricing');
const { checkDomainAvailability } = require('../utils/domainAvailability');
const { checkDynadotAvailability } = require('../utils/dynadotAvailability');
const { getDomainResellerConfig } = require('../utils/domainConfig');
const { defaultLogger } = require('../utils/logger');

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api-pay.fivedit.com';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'your-api-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fivedit.com';

// GET /api/domain/tld-pricing – list active TLDs with register/renew prices (for UI)
router.get('/tld-pricing', async (req, res) => {
  try {
    const list = await listTldPricing();
    res.json({ tlds: list });
  } catch (e) {
    defaultLogger.error('Domain tld-pricing error', e);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

// GET /api/domain/availability?domain=example.com – WHOIS first, Dynadot fallback when configured
router.get('/availability', async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain || !domain.trim()) return res.status(400).json({ error: 'domain query required' });
    const name = domain.trim();
    let result;
    try {
      result = await checkDomainAvailability(name);
    } catch (whoisErr) {
      defaultLogger.warn('WHOIS availability failed, trying Dynadot fallback', whoisErr?.message || whoisErr);
      const config = await getDomainResellerConfig();
      if (config && (config.provider || '').toLowerCase() === 'dynadot' && config.api_key) {
        result = await checkDynadotAvailability(name, config.api_key, config.api_url);
      } else {
        throw whoisErr;
      }
    }
    res.json(result);
  } catch (e) {
    defaultLogger.error('Domain availability error', e);
    res.status(500).json({ error: e.message || 'Failed to check availability' });
  }
});

// GET /api/domain/price?domain=example.com – get price for a domain (for SMM/checkout)
router.get('/price', async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain || !domain.trim()) return res.status(400).json({ error: 'domain query required' });
    const price = await getDomainPrice(domain.trim());
    if (!price) return res.status(404).json({ error: 'TLD not available or not configured' });
    res.json(price);
  } catch (e) {
    defaultLogger.error('Domain price error', e);
    res.status(500).json({ error: 'Failed to get price' });
  }
});

// POST /api/domain/orders – create domain-only order (no SMM package)
router.post('/orders', async (req, res) => {
  try {
    const { domain_name, customer_name, customer_email, customer_phone } = req.body;
    if (!domain_name || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'domain_name, customer_name, customer_email required' });
    }
    const name = domain_name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!name || !name.includes('.')) {
      return res.status(400).json({ error: 'Invalid domain name' });
    }
    const priceInfo = await getDomainPrice(name);
    if (!priceInfo) {
      return res.status(400).json({ error: 'This TLD is not available for registration' });
    }
    try {
      const avail = await checkDomainAvailability(name);
      if (!avail.available) {
        return res.status(400).json({ error: 'This domain is already registered and not available' });
      }
    } catch (availErr) {
      defaultLogger.error('Availability check before domain order', availErr);
      return res.status(400).json({ error: 'Could not verify domain availability. Please try again.' });
    }
    const amount = priceInfo.register_price;
    const currency = priceInfo.currency;
    const orderId = `DOM-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const validateUrl = (url) => {
      try {
        return new URL(url).toString();
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }
    };
    const returnUrl = validateUrl(`${FRONTEND_URL}/domain/order/success?order_id=${encodeURIComponent(orderId)}`);
    const cancelUrl = validateUrl(`${FRONTEND_URL}/domain?cancelled=1`);

    await pool.execute(
      `INSERT INTO domain_orders (
        order_id, domain_name, tld, register_price, renew_price, currency,
        customer_name, customer_email, customer_phone, amount, status, return_url, cancel_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        orderId, name, priceInfo.tld, priceInfo.register_price, priceInfo.renew_price, currency,
        customer_name, customer_email, customer_phone || null, amount, returnUrl, cancelUrl,
      ]
    );

    const paymentPayload = {
      order_id: orderId,
      amount: amount.toFixed(2),
      currency,
      customer_name,
      customer_email,
      customer_phone: customer_phone || '',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      api_key: PAYMENT_API_KEY,
      metadata: JSON.stringify({ type: 'domain', domain_name: name }),
    };

    const payRes = await axios.post(
      `${PAYMENT_GATEWAY_URL}/orders`,
      paymentPayload,
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const transactionId = payRes.data.transaction_id;
    const paymentUrl = payRes.data.payment_url;

    await pool.execute(
      'UPDATE domain_orders SET transaction_id = ?, payment_url = ?, payment_gateway_response = ? WHERE order_id = ?',
      [transactionId, paymentUrl, JSON.stringify(payRes.data), orderId]
    );

    res.json({
      success: true,
      order_id: orderId,
      transaction_id: transactionId,
      payment_url: paymentUrl,
      amount,
      currency,
      domain_name: name,
    });
  } catch (error) {
    defaultLogger.error('Domain order create error', error?.response?.data || error.message);
    if (error.response?.status) {
      return res.status(error.response.status).json({
        error: error.response.data?.message || error.response.data?.error || 'Payment gateway error',
      });
    }
    res.status(500).json({ error: error.message || 'Failed to create domain order' });
  }
});

module.exports = router;
