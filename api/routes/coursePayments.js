const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const pool = require('../config/database');
const { defaultLogger, syncLogger } = require('../utils/logger');
const { sendOrderConfirmationEmail } = require('../utils/email');
const { sendFacebookEvent } = require('../utils/facebookEvents');
const { optionalCustomerAuth } = require('../middleware/optionalCustomerAuth');
const { PAYMENT_GATEWAY_URL, createGatewayOrder } = require('../utils/paymentGateway');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fivedit.com';

// Create payment order for a course
router.post('/orders', optionalCustomerAuth, async (req, res) => {
  try {
    const { course_id, customer_name, customer_email, customer_phone } = req.body;

    if (!course_id || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let customer_id = null;
    if (req.customer && req.customer.id) {
      const [customers] = await pool.execute(
        'SELECT id, email FROM customer_users WHERE id = ? AND email = ?',
        [req.customer.id, customer_email]
      );
      if (customers.length > 0) {
        customer_id = req.customer.id;
        defaultLogger.log(`Course order linked to customer account: ${customer_id} (${customer_email})`);
      } else {
        defaultLogger.warn(`Customer ID ${req.customer.id} email mismatch, not linking course order`);
      }
    }

    const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ? AND status = ?', [course_id, 'published']);
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courses[0];
    const amount = course.discount_price !== null && course.discount_price !== undefined ? course.discount_price : course.price;

    const orderId = `COURSE-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const [orderResult] = await pool.execute(
      `INSERT INTO course_orders (
        order_id, course_id, course_title, amount, currency,
        customer_name, customer_email, customer_phone,
        return_url, cancel_url, status, customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        orderId,
        course_id,
        course.title,
        amount,
        course.currency,
        customer_name,
        customer_email,
        customer_phone || null,
        `${FRONTEND_URL}/courses/payment/success`,
        `${FRONTEND_URL}/courses/payment/cancel`,
        customer_id,
      ]
    );
    defaultLogger.log(`Course order created with ID: ${orderResult.insertId}, customer_id: ${customer_id || 'null'}`);

    const returnUrl = `${FRONTEND_URL}/courses/payment/success?order_id=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${FRONTEND_URL}/courses/payment/cancel?order_id=${encodeURIComponent(orderId)}`;
    const webhookUrl = `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/courses/payments/webhook`;

    try {
      const gatewayResponse = await createGatewayOrder({
        orderId: orderResult.insertId,
        amount,
        currency: course.currency,
        customerName: customer_name,
        customerEmail: customer_email,
        customerPhone: customer_phone,
        returnUrl,
        cancelUrl,
        webhookUrl,
      });

      const transactionId = gatewayResponse.transaction_id;
      const paymentUrl = gatewayResponse.payment_url;
      syncLogger.info('Course payment response:', gatewayResponse);

      await pool.execute(
        'UPDATE course_orders SET transaction_id = ?, payment_url = ?, payment_gateway_response = ? WHERE id = ?',
        [transactionId, paymentUrl, JSON.stringify(gatewayResponse), orderResult.insertId]
      );

      try {
        await sendOrderConfirmationEmail({
          to: customer_email,
          customerName: customer_name,
          orderId,
          packageName: course.title,
          amount,
          currency: course.currency,
          paymentUrl,
        });
      } catch (emailError) {
        defaultLogger.error('Failed to send course order confirmation email:', emailError);
      }

      res.json({
        success: true,
        order_id: orderId,
        transaction_id: transactionId,
        payment_url: paymentUrl,
        amount,
        currency: course.currency,
      });
    } catch (paymentError) {
      defaultLogger.error('Course payment gateway error:', paymentError.response?.data || paymentError.message);

      await pool.execute(
        'UPDATE course_orders SET status = "failed", payment_gateway_response = ? WHERE id = ?',
        [JSON.stringify({ error: paymentError.response?.data || paymentError.message }), orderResult.insertId]
      );

      return res.status(500).json({
        error: 'Failed to create payment order',
        details: paymentError.response?.data || paymentError.message,
      });
    }
  } catch (error) {
    defaultLogger.error('Error creating course payment order:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get order status
router.get('/orders/status/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;

    const [orders] = await pool.execute(
      'SELECT * FROM course_orders WHERE transaction_id = ? OR order_id = ?',
      [transaction_id, transaction_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orders[0];

    try {
      const statusResponse = await axios.get(`${PAYMENT_GATEWAY_URL}/orders/status/${transaction_id}`, { timeout: 5000 });
      const gatewayStatus = statusResponse.data.status;

      if (gatewayStatus !== order.status && gatewayStatus === 'paid') {
        await pool.execute('UPDATE course_orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?', [gatewayStatus, order.id]);
        order.status = gatewayStatus;
      }

      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        course: { id: order.course_id, title: order.course_title },
        customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
        created_at: order.created_at,
        paid_at: order.paid_at,
        gateway_status: gatewayStatus,
      });
    } catch (gatewayError) {
      defaultLogger.error('Error checking payment gateway status:', gatewayError.message);
      res.json({
        order_id: order.order_id,
        transaction_id: order.transaction_id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        course: { id: order.course_id, title: order.course_title },
        customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
        created_at: order.created_at,
        paid_at: order.paid_at,
        note: 'Payment gateway status check failed, showing database status',
      });
    }
  } catch (error) {
    defaultLogger.error('Error fetching course order status:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// Get order by order_id
router.get('/orders/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const [orders] = await pool.execute('SELECT * FROM course_orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(orders[0]);
  } catch (error) {
    defaultLogger.error('Error fetching course order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Payment webhook handler
router.post('/webhook', async (req, res) => {
  try {
    defaultLogger.log('🔔 Course webhook received:', JSON.stringify(req.body, null, 2));
    const { transaction_id, status, order_id, tnx_id } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    let orders = [];

    if (order_id) {
      [orders] = await pool.execute('SELECT * FROM course_orders WHERE id = ?', [order_id]);
    }
    if (orders.length === 0 && order_id) {
      [orders] = await pool.execute('SELECT * FROM course_orders WHERE order_id = ?', [String(order_id)]);
    }
    if (orders.length === 0 && transaction_id) {
      [orders] = await pool.execute('SELECT * FROM course_orders WHERE transaction_id = ?', [transaction_id]);
      if (orders.length > 1 && order_id) {
        const matchingOrder = orders.find((o) => o.id === Number(order_id) || o.order_id === String(order_id));
        orders = [matchingOrder || orders.sort((a, b) => b.id - a.id)[0]];
      }
    }
    if (orders.length === 0 && tnx_id) {
      [orders] = await pool.execute('SELECT * FROM course_orders WHERE transaction_id = ? OR order_id = ?', [tnx_id, tnx_id]);
    }

    if (orders.length === 0) {
      defaultLogger.error('❌ Course webhook: Order not found', { transaction_id, order_id, tnx_id });
      return res.status(200).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    defaultLogger.log(`✅ Found course order: ${order.order_id} (ID: ${order.id}), current status: ${order.status}, new status: ${status}`);

    // Try to link an existing customer account by email
    if (!order.customer_id && order.customer_email) {
      try {
        const [customers] = await pool.execute('SELECT id FROM customer_users WHERE email = ? LIMIT 1', [order.customer_email]);
        if (customers.length > 0) {
          await pool.execute('UPDATE course_orders SET customer_id = ? WHERE id = ?', [customers[0].id, order.id]);
          order.customer_id = customers[0].id;
          defaultLogger.log(`✅ Linked course order ${order.order_id} to customer account ${customers[0].id}`);
        }
      } catch (linkError) {
        defaultLogger.warn('Failed to link course order to customer account:', linkError.message);
      }
    }

    await pool.execute(
      `UPDATE course_orders
       SET status = ?,
           paid_at = CASE WHEN ? IN ('paid', 'completed') AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
           payment_gateway_response = ?,
           transaction_id = COALESCE(?, transaction_id)
       WHERE id = ?`,
      [status, status, JSON.stringify(req.body), transaction_id || tnx_id, order.id]
    );

    const isPaymentSuccessful = status === 'paid' || status === 'completed';
    const wasNotPaid = order.status !== 'paid' && order.status !== 'completed';

    if (isPaymentSuccessful && wasNotPaid) {
      if (order.customer_id) {
        try {
          await pool.execute(
            'INSERT IGNORE INTO course_enrollments (course_id, customer_id, order_id) VALUES (?, ?, ?)',
            [order.course_id, order.customer_id, order.id]
          );
          defaultLogger.log(`✅ Enrolled customer ${order.customer_id} in course ${order.course_id}`);
        } catch (enrollError) {
          defaultLogger.error('Failed to create course enrollment:', enrollError);
        }
      } else {
        try {
          const token = crypto.randomBytes(24).toString('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await pool.execute(
            'UPDATE course_orders SET one_time_login_token = ?, one_time_login_expires_at = ? WHERE id = ?',
            [token, expiresAt, order.id]
          );
          defaultLogger.log(`✅ Issued guest one-time login token for course order ${order.order_id}`);
        } catch (tokenError) {
          defaultLogger.error('Failed to issue guest login token:', tokenError);
        }
      }

      sendFacebookEvent('Purchase', {
        value: Number(order.amount) || 0,
        currency: order.currency || 'USD',
        content_name: order.order_id,
        content_type: 'product',
        email: order.customer_email,
        phone: order.customer_phone,
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    defaultLogger.error('Error processing course webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;
