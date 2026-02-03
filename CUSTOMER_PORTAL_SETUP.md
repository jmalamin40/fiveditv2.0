# Customer Portal Setup Guide

This guide explains the customer portal system for hosting customers.

## Features Implemented

### 1. **Automatic Account Creation**
- After successful payment, the system automatically:
  - Creates a DirectAdmin hosting account
  - Generates secure username and password
  - Sends credentials via email to the customer
  - Links the account to the order in the database

### 2. **Customer Authentication**
- Customer registration and login system
- Separate from admin authentication
- JWT-based authentication with 30-day token expiry

### 3. **Customer Portal**
- **Dashboard**: View orders and hosting accounts
- **Orders Tab**: See all purchase history with status
- **Accounts Tab**: View hosting account details, disk usage, bandwidth
- **Profile Tab**: View and update profile information

### 4. **Checkout Flow**
- Select hosting package
- Fill customer information
- Enter domain and username (optional)
- Redirect to payment gateway
- Automatic account creation after payment

### 5. **Email Notifications**
- Order confirmation email
- Hosting credentials email with login details

## Setup Instructions

### 1. Run Database Migration

```bash
cd api
npm run migrate
```

This will create the `customer_users` table for customer authentication.

### 2. Configure Email (SMTP)

Add these environment variables to your `.env` file in the `api` directory:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@fivedit.com
```

**For Gmail:**
- Use an App Password (not your regular password)
- Enable 2-factor authentication
- Generate App Password: https://myaccount.google.com/apppasswords

**For other providers:**
- Update `SMTP_HOST` and `SMTP_PORT` accordingly
- Set `SMTP_SECURE=true` for port 465 (SSL)

### 3. Install Dependencies

Email functionality requires `nodemailer` (already installed):

```bash
cd api
npm install
```

### 4. Configure Payment Gateway

Ensure these are set in your `.env`:

```env
PAYMENT_GATEWAY_URL=http://your-payment-gateway-url
PAYMENT_API_KEY=your-api-key
FRONTEND_URL=http://your-frontend-url
API_BASE_URL=http://your-api-url
```

### 5. Test the Flow

1. **Purchase Hosting:**
   - Go to `/hosting` page
   - Select a package
   - Click "Get Started"
   - Fill checkout form
   - Complete payment

2. **Check Email:**
   - Customer receives order confirmation
   - After account creation, customer receives credentials email

3. **Customer Portal:**
   - Customer can register/login at `/customer/login`
   - View orders and accounts at `/customer`

## API Endpoints

### Customer Authentication
- `POST /api/customer/auth/register` - Register new customer
- `POST /api/customer/auth/login` - Customer login

### Customer Portal (Protected)
- `GET /api/customer/orders` - Get customer's orders
- `GET /api/customer/accounts` - Get customer's hosting accounts
- `GET /api/customer/orders/:order_id` - Get specific order
- `GET /api/customer/profile` - Get customer profile
- `PUT /api/customer/profile` - Update customer profile

### Payment & Orders
- `POST /api/hosting/payments/orders` - Create payment order
- `GET /api/hosting/payments/orders/:order_id` - Get order status
- `POST /api/hosting/payments/webhook` - Payment webhook (auto-creates account)

## Frontend Pages

- `/hosting` - Hosting plans page
- `/hosting/checkout` - Checkout page
- `/hosting/payment/success` - Payment success page
- `/hosting/payment/cancel` - Payment cancel page
- `/customer/login` - Customer login
- `/customer/register` - Customer registration
- `/customer` - Customer dashboard (protected)

## Webhook Flow

1. Customer completes payment
2. Payment gateway sends webhook to `/api/hosting/payments/webhook`
3. System:
   - Updates order status to "paid"
   - Creates DirectAdmin account automatically
   - Generates secure password
   - Saves account to database
   - Links account to order
   - Sends credentials email to customer
   - Updates order status to "completed"

## Email Templates

### Order Confirmation Email
Sent immediately after order creation, includes:
- Order ID
- Package details
- Amount and billing period

### Hosting Credentials Email
Sent after account creation, includes:
- Domain name
- Username
- Password
- DirectAdmin login URL
- Security instructions
- Next steps

## Security Features

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Customer data is isolated (customers can only see their own orders/accounts)
- Secure password generation for hosting accounts
- Email credentials sent securely

## Troubleshooting

### Emails Not Sending
1. Check SMTP credentials in `.env`
2. Verify SMTP server allows connections
3. Check API logs for email errors
4. For Gmail, ensure App Password is used (not regular password)

### Account Creation Fails
1. Verify DirectAdmin configuration in admin panel
2. Check DirectAdmin API connectivity
3. Review API logs for DirectAdmin errors
4. Ensure package name matches DirectAdmin package

### Customer Can't Login
1. Verify customer registered successfully
2. Check JWT_SECRET is set in `.env`
3. Verify token is stored in localStorage
4. Check browser console for errors

## Notes

- Customer accounts are separate from admin accounts
- Customers can have multiple orders and accounts
- Account credentials are sent via email only (not stored in plain text)
- DirectAdmin account creation happens automatically after payment
- All customer routes require authentication

