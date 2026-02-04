const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

// Generate unique invoice number
function generateInvoiceNumber() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

// Auto-generate invoice for an order
async function generateInvoiceForOrder(orderId) {
  try {
    // Check if invoice already exists
    const [existing] = await pool.execute(
      'SELECT id FROM invoices WHERE order_id = ?',
      [orderId]
    );

    if (existing.length > 0) {
      defaultLogger.log(`Invoice already exists for order ${orderId}`);
      return existing[0].id;
    }

    // Get order details
    const [orders] = await pool.execute(
      `SELECT 
        ho.*,
        hp.display_name as package_display_name,
        hp.description as package_description
      FROM hosting_orders ho
      LEFT JOIN hosting_packages hp ON ho.package_id = hp.id
      WHERE ho.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orders[0];

    // Calculate amounts
    const amount = parseFloat(order.amount || 0);
    const taxAmount = 0; // Can be configured later
    const discountAmount = 0; // Can be configured later
    const totalAmount = amount + taxAmount - discountAmount;

    // Create invoice items
    const invoiceItems = [
      {
        description: order.package_display_name || order.package_name,
        quantity: 1,
        unit_price: amount,
        total: amount,
        billing_period: order.billing_period,
      }
    ];

    // Calculate due date (30 days from now for monthly, 365 days for yearly)
    const dueDate = new Date();
    if (order.billing_period === 'yearly') {
      dueDate.setDate(dueDate.getDate() + 365);
    } else {
      dueDate.setDate(dueDate.getDate() + 30);
    }

    // Determine invoice status
    let invoiceStatus = 'sent';
    if (order.status === 'paid' || order.status === 'completed') {
      invoiceStatus = 'paid';
    }

    // Create invoice
    const invoiceNumber = generateInvoiceNumber();
    const [result] = await pool.execute(
      `INSERT INTO invoices (
        invoice_number, order_id, customer_id, customer_name, customer_email, customer_phone,
        amount, tax_amount, discount_amount, total_amount, currency, status, due_date,
        paid_at, invoice_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        orderId,
        order.customer_id || null,
        order.customer_name,
        order.customer_email,
        order.customer_phone || null,
        amount,
        taxAmount,
        discountAmount,
        totalAmount,
        order.currency || 'BDT',
        invoiceStatus,
        dueDate,
        order.paid_at || null,
        JSON.stringify(invoiceItems),
      ]
    );

    defaultLogger.log(`✅ Invoice ${invoiceNumber} created for order ${order.order_id}`);
    return result.insertId;
  } catch (error) {
    defaultLogger.error('Error generating invoice:', error);
    throw error;
  }
}

// Customer routes - require customer authentication
const customerRouter = express.Router();
customerRouter.use(authenticate);

// Middleware to check if user is a customer
function requireCustomer(req, res, next) {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Access denied. Customer access required.' });
  }
  next();
}

customerRouter.use(requireCustomer);

// Get customer's invoices
customerRouter.get('/', async (req, res) => {
  try {
    const customerId = req.user.id;
    const customerEmail = req.user.email;

    const [invoices] = await pool.execute(
      `SELECT 
        i.*,
        ho.order_id as order_reference,
        ho.package_name,
        ho.billing_period
      FROM invoices i
      LEFT JOIN hosting_orders ho ON i.order_id = ho.id
      WHERE (i.customer_id = ? OR i.customer_email = ?)
      ORDER BY i.created_at DESC`,
      [customerId, customerEmail]
    );

    // Parse invoice_items JSON
    const invoicesWithItems = invoices.map(invoice => ({
      ...invoice,
      invoice_items: typeof invoice.invoice_items === 'string' 
        ? JSON.parse(invoice.invoice_items) 
        : invoice.invoice_items,
    }));

    res.json({ invoices: invoicesWithItems });
  } catch (error) {
    defaultLogger.error('Error fetching customer invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice
customerRouter.get('/:invoice_id', async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const customerId = req.user.id;
    const customerEmail = req.user.email;

    const [invoices] = await pool.execute(
      `SELECT 
        i.*,
        ho.order_id as order_reference,
        ho.package_name,
        ho.billing_period,
        ho.domain,
        ho.username
      FROM invoices i
      LEFT JOIN hosting_orders ho ON i.order_id = ho.id
      WHERE i.id = ? AND (i.customer_id = ? OR i.customer_email = ?)`,
      [invoice_id, customerId, customerEmail]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];
    invoice.invoice_items = typeof invoice.invoice_items === 'string' 
      ? JSON.parse(invoice.invoice_items) 
      : invoice.invoice_items;

    res.json({ invoice });
  } catch (error) {
    defaultLogger.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Admin routes - require admin authentication
const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// Get all invoices (admin)
adminRouter.get('/', async (req, res) => {
  try {
    const { status, customer_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        i.*,
        ho.order_id as order_reference,
        ho.package_name,
        ho.billing_period,
        cu.name as customer_name_full
      FROM invoices i
      LEFT JOIN hosting_orders ho ON i.order_id = ho.id
      LEFT JOIN customer_users cu ON i.customer_id = cu.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (customer_id) {
      query += ' AND i.customer_id = ?';
      params.push(customer_id);
    }

    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [invoices] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM invoices WHERE 1=1';
    const countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (customer_id) {
      countQuery += ' AND customer_id = ?';
      countParams.push(customer_id);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    // Parse invoice_items JSON
    const invoicesWithItems = invoices.map(invoice => ({
      ...invoice,
      invoice_items: typeof invoice.invoice_items === 'string' 
        ? JSON.parse(invoice.invoice_items) 
        : invoice.invoice_items,
    }));

    res.json({
      invoices: invoicesWithItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    defaultLogger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice (admin)
adminRouter.get('/:invoice_id', async (req, res) => {
  try {
    const { invoice_id } = req.params;

    const [invoices] = await pool.execute(
      `SELECT 
        i.*,
        ho.order_id as order_reference,
        ho.package_name,
        ho.billing_period,
        ho.domain,
        ho.username,
        cu.name as customer_name_full
      FROM invoices i
      LEFT JOIN hosting_orders ho ON i.order_id = ho.id
      LEFT JOIN customer_users cu ON i.customer_id = cu.id
      WHERE i.id = ?`,
      [invoice_id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];
    invoice.invoice_items = typeof invoice.invoice_items === 'string' 
      ? JSON.parse(invoice.invoice_items) 
      : invoice.invoice_items;

    res.json({ invoice });
  } catch (error) {
    defaultLogger.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Update invoice status (admin)
adminRouter.put('/:invoice_id/status', async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'paid') {
      updateData.paid_at = new Date();
    }
    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'paid') {
      await pool.execute(
        `UPDATE invoices 
         SET status = ?, paid_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
         WHERE id = ?`,
        [status, notes || null, invoice_id]
      );
    } else {
      await pool.execute(
        `UPDATE invoices 
         SET status = ?, notes = COALESCE(?, notes)
         WHERE id = ?`,
        [status, notes || null, invoice_id]
      );
    }

    res.json({ success: true, message: 'Invoice status updated' });
  } catch (error) {
    defaultLogger.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// Generate invoice for order (admin)
adminRouter.post('/generate/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const invoiceId = await generateInvoiceForOrder(order_id);
    
    const [invoices] = await pool.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    const invoice = invoices[0];
    invoice.invoice_items = typeof invoice.invoice_items === 'string' 
      ? JSON.parse(invoice.invoice_items) 
      : invoice.invoice_items;

    res.json({ invoice, message: 'Invoice generated successfully' });
  } catch (error) {
    defaultLogger.error('Error generating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice' });
  }
});

module.exports = {
  router: router,
  customerRouter,
  adminRouter,
  generateInvoiceForOrder,
};

