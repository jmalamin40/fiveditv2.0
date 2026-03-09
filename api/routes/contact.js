/**
 * Contact form API. POST /api/contact accepts { name, email, phone?, company?, message },
 * stores in contact_inquiries, and sends notification email via SMTP.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendContactFormEmail } = require('../utils/email');
const { defaultLogger } = require('../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, message } = req.body || {};

    const n = (name && String(name).trim()) || '';
    const e = (email && String(email).trim()) || '';
    const msg = (message && String(message).trim()) || '';
    if (!n || n.length > 255) {
      return res.status(400).json({ error: 'Valid full name is required.' });
    }
    if (!e || !EMAIL_REGEX.test(e) || e.length > 255) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!msg || msg.length > 10000) {
      return res.status(400).json({ error: 'Message is required (max 10000 characters).' });
    }

    const phoneVal = (phone && String(phone).trim()) || null;
    const companyVal = (company && String(company).trim()) || null;
    if (phoneVal && phoneVal.length > 50) {
      return res.status(400).json({ error: 'Phone number is too long.' });
    }
    if (companyVal && companyVal.length > 255) {
      return res.status(400).json({ error: 'Company name is too long.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO contact_inquiries (name, email, phone, company, message) VALUES (?, ?, ?, ?, ?)`,
      [n, e, phoneVal, companyVal, msg]
    );
    const id = result.insertId;
    defaultLogger.log(`Contact inquiry #${id} from ${e}`);

    try {
      await sendContactFormEmail({
        name: n,
        email: 'jomaddarit@gmail.com',
        phone: phoneVal,
        company: companyVal,
        message: msg,
      });
    } catch (emailErr) {
      defaultLogger.error('Contact form notification email failed:', emailErr);
      // Do not fail the request; inquiry is already stored
    }

    res.status(201).json({ success: true, id });
  } catch (err) {
    defaultLogger.error('Contact form submit error:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    res.status(500).json({ error: 'Unable to submit your message. Please try again later.' });
  }
});

module.exports = router;
