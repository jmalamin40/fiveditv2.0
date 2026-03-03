const nodemailer = require('nodemailer');
const { defaultLogger } = require('./logger');

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  // Configure email transporter
  // You can use SMTP, Gmail, SendGrid, etc.
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    // Add connection timeout and other options
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // For Gmail and other providers that require TLS
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
  };

  // Log configuration (without sensitive data)
  defaultLogger.log('📧 Email transporter configuration:');
  defaultLogger.log(`   Host: ${emailConfig.host}`);
  defaultLogger.log(`   Port: ${emailConfig.port}`);
  defaultLogger.log(`   Secure: ${emailConfig.secure}`);
  defaultLogger.log(`   User: ${emailConfig.auth.user ? 'SET' : 'NOT SET'}`);
  defaultLogger.log(`   Pass: ${emailConfig.auth.pass ? 'SET' : 'NOT SET'}`);

  // If no SMTP credentials, return null (will be handled by caller)
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    defaultLogger.warn('⚠️  SMTP credentials not configured. Emails will not be sent.');
    defaultLogger.warn('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
    defaultLogger.warn('   For Gmail, use App Password (not regular password)');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    
    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        defaultLogger.error('❌ SMTP connection verification failed:', error);
      } else {
        defaultLogger.log('✅ SMTP connection verified successfully');
      }
    });
    
    return transporter;
  } catch (error) {
    defaultLogger.error('❌ Failed to create email transporter:', error);
    return null;
  }
}

/**
 * Send hosting account credentials email to customer
 */
async function sendHostingCredentialsEmail({
  to,
  customerName,
  domain,
  username,
  password,
  packageName,
  cpanelUrl,
  directAdminUrl,
}) {
  try {
    // Validate required parameters
    if (!to || !customerName || !domain || !username || !password) {
      throw new Error('Missing required email parameters');
    }

    defaultLogger.log(`📧 Attempting to send hosting credentials email to: ${to}`);
    defaultLogger.log(`   Domain: ${domain}, Username: ${username}, Package: ${packageName}`);

    const emailTransporter = getTransporter();
    
    // Check if transporter is properly configured
    if (!emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    // Verify SMTP credentials are configured
    const hasCredentials = process.env.SMTP_USER && process.env.SMTP_PASS;
    if (!hasCredentials) {
      defaultLogger.warn('⚠️  SMTP credentials not configured. Email will not be sent.');
      defaultLogger.warn('   Please set SMTP_USER and SMTP_PASS in .env file');
      throw new Error('SMTP credentials not configured');
    }
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fivedit.com',
      to: to,
      subject: `Your Hosting Account is Ready - ${domain}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
            .credentials { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
            .credential-item { margin: 10px 0; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 3px; }
            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your Hosting Account is Ready!</h1>
            </div>
            <div class="content">
              <p>Dear ${customerName},</p>
              
              <p>Thank you for your purchase! Your hosting account has been successfully created and is now active.</p>
              
              <div class="credentials">
                <h2 style="margin-top: 0;">Account Details</h2>
                <div class="credential-item">
                  <span class="label">Domain:</span>
                  <span class="value">${domain}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Package:</span>
                  <span class="value">${packageName}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Username:</span>
                  <span class="value">${username}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Password:</span>
                  <span class="value">${password}</span>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                ${directAdminUrl ? `<a href="${directAdminUrl}" target="_blank" style="color: white;" class="button">Access DirectAdmin</a>` : ''}
                ${cpanelUrl ? `<a href="${cpanelUrl}" target="_blank" style="color: white;" class="button">Access cPanel</a>` : ''}
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul>
                  <li>Please change your password immediately after first login</li>
                  <li>Keep your credentials secure and do not share them</li>
                  <li>If you did not request this account, please contact support immediately</li>
                </ul>
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li>Log in to your control panel using the credentials above</li>
                <li>Upload your website files via FTP or File Manager</li>
                <li>Set up your email accounts</li>
                <li>Install SSL certificate (if not already installed)</li>
                <li>Configure your domain DNS settings</li>
              </ul>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>FivedIT Hosting Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} FivedIT. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your Hosting Account is Ready!

Dear ${customerName},

Thank you for your purchase! Your hosting account has been successfully created.

Account Details:
- Domain: ${domain}
- Package: ${packageName}
- Username: ${username}
- Password: ${password}

${directAdminUrl ? `DirectAdmin URL: ${directAdminUrl}` : ''}
${cpanelUrl ? `cPanel URL: ${cpanelUrl}` : ''}

Important: Please change your password immediately after first login.

If you have any questions, please contact our support team.

Best regards,
FivedIT Hosting Team
      `,
    };

    defaultLogger.log(`📤 Sending email via ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '587'}`);
    defaultLogger.log(`   From: ${mailOptions.from}`);
    defaultLogger.log(`   To: ${mailOptions.to}`);
    defaultLogger.log(`   Subject: ${mailOptions.subject}`);

    const info = await emailTransporter.sendMail(mailOptions);
    
    defaultLogger.log(`✅ Hosting credentials email sent successfully to ${to}`);
    defaultLogger.log(`   Message ID: ${info.messageId || 'N/A'}`);
    defaultLogger.log(`   Response: ${info.response || 'N/A'}`);
    
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    defaultLogger.error('❌ Error sending hosting credentials email:');
    defaultLogger.error('   Error message:', error?.message || 'No message');
    defaultLogger.error('   Error code:', error?.code || 'N/A');
    defaultLogger.error('   Error command:', error?.command || 'N/A');
    defaultLogger.error('   Error response:', error?.response || 'N/A');
    defaultLogger.error('   Error responseCode:', error?.responseCode || 'N/A');
    defaultLogger.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Log SMTP configuration status
    defaultLogger.error('   SMTP Configuration:');
    defaultLogger.error(`     SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
    defaultLogger.error(`     SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
    defaultLogger.error(`     SMTP_USER: ${process.env.SMTP_USER ? 'SET' : 'NOT SET'}`);
    defaultLogger.error(`     SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
    defaultLogger.error(`     SMTP_FROM: ${process.env.SMTP_FROM || 'NOT SET'}`);
    
    throw error;
  }
}

/**
 * Send order confirmation email
 * (Sent immediately after order is created - confirms receipt of order)
 */
async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderId,
  packageName,
  amount,
  paymentUrl,
  currency,
  billingPeriod,
}) {
  try {
    // Validate required parameters
    if (!to || !customerName || !orderId || !packageName || amount === undefined) {
      throw new Error('Missing required email parameters');
    }

    defaultLogger.log(`📧 Attempting to send order confirmation email to: ${to}`);
    defaultLogger.log(`Order ID: ${orderId}, Package: ${packageName}, Amount: ${amount} ${currency}`);

    const emailTransporter = getTransporter();

    // Check if transporter is properly configured
    if (!emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    // Verify SMTP credentials are configured
    const hasCredentials = process.env.SMTP_USER && process.env.SMTP_PASS;
    if (!hasCredentials) {
      defaultLogger.warn('⚠️ SMTP credentials not configured. Email will not be sent.');
      defaultLogger.warn('Please set SMTP_USER and SMTP_PASS in .env file');
      throw new Error('SMTP credentials not configured');
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fivedit.com',
      to: to,
      subject: `Order Confirmation - ${orderId}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .order-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Order Confirmation</h1>
  </div>
  <div class="content">
    <p>Dear ${customerName},</p>

    <p>Thank you for your order! We have successfully received and confirmed your order.</p>

    <div class="order-details">
      <h2 style="margin-top: 0;">Order Details</h2>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Package:</strong> ${packageName}</p>
      <p><strong>Billing Period:</strong> ${billingPeriod === 'monthly' ? 'Monthly' : 'Yearly'}</p>
      <p><strong>Amount:</strong> ${currency} ${Number(amount || 0).toFixed(2)}</p>
    </div>

    <p>Next steps:</p>
    <ul>
      <li>Please complete the payment using the secure payment link that was provided during checkout.</li>
      <li>Once payment is confirmed, your hosting account will be automatically set up.</li>
      <li>You will receive a separate email with your account credentials and control panel login details shortly after payment.</li>
    </ul>

    <p>If you have any questions or need assistance with payment, please contact our support team.</p>

    <p>Best regards,<br>FivedIT Hosting Team</p>
  </div>
  <div class="footer">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</div>
</body>
</html>
      `,
    };

    defaultLogger.log(`📤 Sending email via ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '587'}`);
    defaultLogger.log(`From: ${mailOptions.from}`);
    defaultLogger.log(`To: ${mailOptions.to}`);
    defaultLogger.log(`Subject: ${mailOptions.subject}`);

    const info = await emailTransporter.sendMail(mailOptions);

    defaultLogger.log(`✅ Order confirmation email sent successfully to ${to}`);
    defaultLogger.log(`Message ID: ${info.messageId || 'N/A'}`);
    defaultLogger.log(`Response: ${info.response || 'N/A'}`);

    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    defaultLogger.error('❌ Error sending order confirmation email:');
    defaultLogger.error(`Error message: ${error?.message || 'No message'}`);
    defaultLogger.error(`Error code: ${error?.code || 'N/A'}`);
    defaultLogger.error(`Error command: ${error?.command || 'N/A'}`);
    defaultLogger.error(`Error response: ${error?.response || 'N/A'}`);
    defaultLogger.error(`Error responseCode: ${error?.responseCode || 'N/A'}`);
    defaultLogger.error(`Error stack: ${error?.stack || 'No stack'}`);
    defaultLogger.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Log SMTP configuration status
    defaultLogger.error('SMTP Configuration:');
    defaultLogger.error(`SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
    defaultLogger.error(`SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
    defaultLogger.error(`SMTP_USER: ${process.env.SMTP_USER ? 'SET' : 'NOT SET'}`);
    defaultLogger.error(`SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
    defaultLogger.error(`SMTP_FROM: ${process.env.SMTP_FROM || 'NOT SET'}`);

    throw error;
  }
}

/**
 * Send SMM site credentials email to customer after Supabase user is created.
 * Includes site URL, login email, and password.
 */
async function sendSmmCredentialsEmail({
  to,
  customerName,
  siteUrl,
  loginEmail,
  password,
  adminUrl,
}) {
  try {
    if (!to || !siteUrl || !loginEmail || !password) {
      throw new Error('Missing required SMM email parameters (to, siteUrl, loginEmail, password)');
    }

    defaultLogger.log(`📧 Sending SMM credentials email to: ${to}`);
    defaultLogger.log(`   Site: ${siteUrl}, Login: ${loginEmail}`);

    const emailTransporter = getTransporter();
    if (!emailTransporter) {
      defaultLogger.warn('⚠️ Email transporter not configured. SMM credentials email skipped.');
      return { success: false, skipped: true, reason: 'SMTP not configured' };
    }

    const hasCredentials = process.env.SMTP_USER && process.env.SMTP_PASS;
    if (!hasCredentials) {
      defaultLogger.warn('⚠️ SMTP credentials not configured. SMM credentials email skipped.');
      return { success: false, skipped: true, reason: 'SMTP credentials not set' };
    }

    const name = customerName || to.split('@')[0] || 'Customer';
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fivedit.com',
      to,
      subject: `Your SMM Store is Ready – ${siteUrl.replace(/^https?:\/\//, '').split('/')[0]}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .credentials { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2563eb; }
            .credential-item { margin: 10px 0; }
            .label { font-weight: bold; color: #6b7280; }
            .value { color: #111; font-family: monospace; background: #f3f4f6; padding: 6px 10px; border-radius: 3px; word-break: break-all; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your SMM Store is Ready</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <p>Your Social Media Marketing store has been set up and your admin account is ready.</p>
              <div class="credentials">
                <h2 style="margin-top: 0;">Login details</h2>
                <div class="credential-item">
                  <span class="label">Store URL:</span><br>
                  <span class="value">${siteUrl}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Admin URL:</span><br>
                  <span class="value">${adminUrl}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Email:</span><br>
                  <span class="value">${loginEmail}</span>
                </div>
                <div class="credential-item">
                  <span class="label">Password:</span><br>
                  <span class="value">${password}</span>
                </div>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${siteUrl}" target="_blank" class="button">Open your store</a>
              </div>
              <div class="warning">
                <strong>Keep your password safe.</strong> You can change it after logging in. Do not share these credentials.
              </div>
              <p>If you have any questions, contact our support team.</p>
              <p>Best regards,<br>FivedIT Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your SMM Store is Ready

Dear ${name},

Your store has been set up. Use these details to log in:

Store URL: ${siteUrl}
Email: ${loginEmail}
Password: ${password}

Open your store: ${siteUrl}

Keep your password safe. Do not share these credentials.

Best regards,
FivedIT Team
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    defaultLogger.log(`✅ SMM credentials email sent to ${to} (Message ID: ${info.messageId || 'N/A'})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    defaultLogger.error('❌ Error sending SMM credentials email:', error?.message || error);
    throw error;
  }
}

module.exports = {
  sendHostingCredentialsEmail,
  sendOrderConfirmationEmail,
  sendSmmCredentialsEmail,
  getTransporter,
};

