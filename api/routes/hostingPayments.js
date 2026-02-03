const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'http://localhost:3000';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'your-api-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Create payment order for hosting
router.post('/orders', async (req, res) => {
  try {
    const {
      package_id,
      billing_period,
      customer_name,
      customer_email,
      customer_phone,
      domain,
      username,
    } = req.body;

    if (!package_id || !billing_period || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get package details
    const [packages] = await pool.execute(
      'SELECT * FROM hosting_packages WHERE id = ? AND is_active = TRUE',
      [package_id]
    );

    if (packages.length === 0) {
      return res.status(404).json({ error: 'Hosting package not found' });
    }

    const packageData = packages[0];
    const amount = billing_period === 'yearly' ? packageData.price_yearly : packageData.price_monthly;

    // Generate unique order ID
    const orderId = `HOST-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create order in database
    const [orderResult] = await pool.execute(
      `INSERT INTO hosting_orders (
        order_id, package_id, package_name, billing_period, amount, currency,
        customer_name, customer_email, customer_phone, domain, username,
        return_url, cancel_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        orderId,
        package_id,
        packageData.display_name,
        billing_period,
        amount,
        packageData.currency,
        customer_name,
        customer_email,
        customer_phone || null,
        domain || null,
        username || null,
        `${FRONTEND_URL}/hosting/payment/success`,
        `${FRONTEND_URL}/hosting/payment/cancel`,
      ]
    );

    // Create payment order with payment gateway
    const paymentGatewayData = {
      order_id: orderResult.insertId, // Use database ID as order_id for payment gateway
      amount: amount.toFixed(2),
      currency: packageData.currency,
      customer_name,
      customer_email,
      customer_phone: customer_phone || '',
      return_url: `${FRONTEND_URL}/hosting/payment/success?order_id=${orderId}`,
      cancel_url: `${FRONTEND_URL}/hosting/payment/cancel?order_id=${orderId}`,
      api_key: PAYMENT_API_KEY,
      webhook_url: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/hosting/payments/webhook`,
    };

    try {
      const paymentResponse = await axios.post(
        `${PAYMENT_GATEWAY_URL}/orders`,
        paymentGatewayData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const transactionId = paymentResponse.data.transaction_id;
      const paymentUrl = paymentResponse.data.payment_url;

      // Update order with transaction ID and payment URL
      await pool.execute(
        'UPDATE hosting_orders SET transaction_id = ?, payment_url = ?, payment_gateway_response = ? WHERE id = ?',
        [
          transactionId,
          paymentUrl,
          JSON.stringify(paymentResponse.data),
          orderResult.insertId,
        ]
      );

      res.json({
        success: true,
        order_id: orderId,
        transaction_id: transactionId,
        payment_url: paymentUrl,
        amount,
        currency: packageData.currency,
      });
    } catch (paymentError) {
      console.error('Payment gateway error:', paymentError.response?.data || paymentError.message);
      
      // Update order status to failed
      await pool.execute(
        'UPDATE hosting_orders SET status = "failed", payment_gateway_response = ? WHERE id = ?',
        [
          JSON.stringify({ error: paymentError.response?.data || paymentError.message }),
          orderResult.insertId,
        ]
      );

      return res.status(500).json({
        error: 'Failed to create payment order',
        details: paymentError.response?.data || paymentError.message,
      });
    }
  } catch (error) {
    console.error('Error creating hosting payment order:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Get order status
router.get('/orders/status/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;

    // Get order from database
    const [orders] = await pool.execute(
      `SELECT ho.*, hp.name as package_slug, hp.display_name as package_display_name
       FROM hosting_orders ho
       LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
       WHERE ho.transaction_id = ? OR ho.order_id = ?`,
      [transaction_id, transaction_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Also check with payment gateway
    try {
      const statusResponse = await axios.get(
        `${PAYMENT_GATEWAY_URL}/orders/status/${transaction_id}`,
        { timeout: 5000 }
      );

      const gatewayStatus = statusResponse.data.status;

      // Update order status if payment gateway status is different
      if (gatewayStatus !== order.status && gatewayStatus === 'paid') {
        await pool.execute(
          'UPDATE hosting_orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [gatewayStatus, order.id]
        );
        order.status = gatewayStatus;
      }

      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        package: {
          id: order.package_id,
          name: order.package_slug,
          display_name: order.package_display_name,
        },
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
        created_at: order.created_at,
        paid_at: order.paid_at,
        gateway_status: gatewayStatus,
      });
    } catch (gatewayError) {
      // If gateway check fails, return database status
      console.error('Error checking payment gateway status:', gatewayError.message);
      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        package: {
          id: order.package_id,
          name: order.package_slug,
          display_name: order.package_display_name,
        },
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
        created_at: order.created_at,
        paid_at: order.paid_at,
        note: 'Payment gateway status check failed, showing database status',
      });
    }
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Payment webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const { transaction_id, status, order_id } = req.body;

    if (!transaction_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find order by transaction_id or order_id
    const [orders] = await pool.execute(
      'SELECT * FROM hosting_orders WHERE transaction_id = ? OR order_id = ?',
      [transaction_id, order_id]
    );

    if (orders.length === 0) {
      console.error('Webhook: Order not found', { transaction_id, order_id });
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Update order status
    await pool.execute(
      `UPDATE hosting_orders 
       SET status = ?, 
           paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
           payment_gateway_response = ?
       WHERE id = ?`,
      [status, status, JSON.stringify(req.body), order.id]
    );

    // If payment is successful, create hosting account
    if (status === 'paid' && order.status !== 'paid') {
      try {
        // Import hosting routes to create account
        const hostingRoutes = require('./hosting');
        
        // Create hosting account via DirectAdmin
        // This will be handled by the hosting account creation endpoint
        // For now, we'll just log it
        console.log('Payment successful, should create hosting account for order:', order.order_id);
        
        // You can trigger account creation here or use a queue system
        // For now, we'll set a flag that can be processed later
        await pool.execute(
          'UPDATE hosting_orders SET status = "completed" WHERE id = ?',
          [order.id]
        );
      } catch (accountError) {
        console.error('Error creating hosting account after payment:', accountError);
        // Don't fail the webhook, just log the error
      }
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Get order by order_id (for frontend)
router.get('/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;

    const [orders] = await pool.execute(
      `SELECT ho.*, hp.name as package_slug, hp.display_name as package_display_name
       FROM hosting_orders ho
       LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
       WHERE ho.order_id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    res.json({
      order_id: order.order_id,
      transaction_id: order.transaction_id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      billing_period: order.billing_period,
      package: {
        id: order.package_id,
        name: order.package_slug,
        display_name: order.package_display_name,
      },
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      domain: order.domain,
      username: order.username,
      payment_url: order.payment_url,
      created_at: order.created_at,
      paid_at: order.paid_at,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;

