const axios = require('axios');
const { defaultLogger } = require('./logger');

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api-pay.fivedit.com';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'your-api-key';

// Validates a URL and warns (but doesn't fail) on localhost, since the gateway may reject it.
function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      defaultLogger.warn(`⚠️  Using localhost URL: ${url}`);
      defaultLogger.warn('   Payment gateway may reject localhost URLs. Consider using ngrok or a public domain.');
    }
    return urlObj.toString();
  } catch (error) {
    defaultLogger.error('Invalid URL format:', url, error);
    throw new Error(`Invalid URL format: ${url}`);
  }
}

// Creates an order with the FiveEdit payment gateway. Throws on failure (axios error).
async function createGatewayOrder({
  orderId,
  amount,
  currency,
  customerName,
  customerEmail,
  customerPhone,
  returnUrl,
  cancelUrl,
  webhookUrl,
}) {
  const payload = {
    order_id: orderId,
    amount: Number(amount)?.toFixed(2) || '0.00',
    currency,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone || '',
    return_url: validateUrl(returnUrl),
    cancel_url: validateUrl(cancelUrl),
    api_key: PAYMENT_API_KEY,
    webhook_url: validateUrl(webhookUrl),
  };

  const response = await axios.post(`${PAYMENT_GATEWAY_URL}/orders`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  return response.data;
}

module.exports = { PAYMENT_GATEWAY_URL, PAYMENT_API_KEY, validateUrl, createGatewayOrder };
