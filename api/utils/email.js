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
  };

  // If no SMTP credentials, use a test account (won't actually send emails)
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    defaultLogger.warn('⚠️  SMTP credentials not configured. Emails will not be sent.');
    defaultLogger.warn('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
    
    // Create a test transporter (won't send real emails)
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'test@example.com',
        pass: 'test',
      },
    });
    return transporter;
  }

  transporter = nodemailer.createTransport(emailConfig);
  return transporter;
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
    const emailTransporter = getTransporter();
    
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
                ${directAdminUrl ? `<a href="${directAdminUrl}" class="button">Access DirectAdmin</a>` : ''}
                ${cpanelUrl ? `<a href="${cpanelUrl}" class="button">Access cPanel</a>` : ''}
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

    const info = await emailTransporter.sendMail(mailOptions);
    defaultLogger.log(`✅ Hosting credentials email sent to ${to}`);
    defaultLogger.debug('Email info:', info);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    defaultLogger.error('❌ Error sending hosting credentials email:', error);
    throw error;
  }
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderId,
  packageName,
  amount,
  currency,
  billingPeriod,
}) {
  try {
    const emailTransporter = getTransporter();
    
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
              
              <p>Thank you for your order! We have received your payment and are processing your hosting account.</p>
              
              <div class="order-details">
                <h2 style="margin-top: 0;">Order Details</h2>
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Package:</strong> ${packageName}</p>
                <p><strong>Billing Period:</strong> ${billingPeriod === 'monthly' ? 'Monthly' : 'Yearly'}</p>
                <p><strong>Amount:</strong> ${currency} ${amount.toFixed(2)}</p>
              </div>
              
              <p>Your hosting account will be set up shortly. You will receive another email with your account credentials once it's ready.</p>
              
              <p>If you have any questions, please contact our support team.</p>
              
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

    const info = await emailTransporter.sendMail(mailOptions);
    defaultLogger.log(`✅ Order confirmation email sent to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    defaultLogger.error('❌ Error sending order confirmation email:', error);
    throw error;
  }
}

module.exports = {
  sendHostingCredentialsEmail,
  sendOrderConfirmationEmail,
  getTransporter,
};

