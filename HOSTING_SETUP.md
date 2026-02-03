# Hosting Management Setup Guide

This guide explains how to set up and use the AsuraHosting reseller hosting management system.

## Prerequisites

1. **AsuraHosting Reseller Account**: You need an active reseller hosting account from AsuraHosting.com
2. **WHM Access**: You need WHM (Web Host Manager) credentials from your reseller account
3. **Database Migration**: Run the database migration to create hosting tables

## Setup Steps

### 1. Run Database Migration

```bash
cd api
node scripts/migrate.js
```

This will create:
- `hosting_accounts` table - Stores all hosting account information
- `hosting_config` table - Stores WHM credentials (encrypted)

### 2. Set Encryption Key (Important!)

Add to your `.env` file:

```env
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

**Important**: Use a strong, random 32-character string. This encrypts your WHM password in the database.

Example:
```bash
# Generate a random key
openssl rand -hex 16
```

### 3. Configure WHM in Admin Panel

1. Log into the admin panel
2. Navigate to the **Hosting** tab
3. Click **Configure WHM**
4. Enter your WHM credentials:
   - **WHM Host**: Usually `whm.asurahosting.com` or your server IP
   - **WHM Username**: Your reseller username
   - **WHM Password**: Your reseller password
   - **WHM Port**: Usually `2087` (SSL) or `2086` (non-SSL)
   - **Use SSL**: Check this for secure connection
   - **Reseller Username**: Optional, your reseller account username

5. Click **Save Configuration**
6. Click **Test Connection** to verify

### 4. Sync Existing Accounts

After configuration:
1. Click **Sync from WHM** to import all existing hosting accounts
2. The system will automatically:
   - Create new accounts in the database
   - Update existing accounts with latest information
   - Sync account status, disk usage, bandwidth, etc.

## Features

### Account Management

- **View All Accounts**: See all hosting accounts with status, usage, and customer info
- **Create New Account**: Create hosting accounts directly from the admin panel
- **Suspend/Unsuspend**: Suspend or unsuspend accounts
- **Terminate**: Permanently delete accounts (use with caution!)
- **Search & Filter**: Search by domain, username, customer name/email
- **Status Filter**: Filter by active, suspended, terminated, or pending

### Statistics Dashboard

- Total accounts count
- Active/Suspended/Terminated breakdown
- Total disk usage
- Total bandwidth usage

### Account Details

Each account shows:
- Domain name
- Username
- Package/Plan name
- Status (Active, Suspended, Terminated, Pending)
- Customer information (name, email, phone)
- Disk usage with progress bar
- Bandwidth usage
- cPanel link (if available)
- IP address

## API Endpoints

All endpoints require admin authentication:

- `GET /api/admin/hosting/config` - Get WHM configuration
- `POST /api/admin/hosting/config` - Save/Update WHM configuration
- `POST /api/admin/hosting/config/test` - Test WHM connection
- `GET /api/admin/hosting/accounts` - List accounts (with pagination, search, filters)
- `POST /api/admin/hosting/accounts/sync` - Sync accounts from WHM
- `POST /api/admin/hosting/accounts` - Create new account
- `POST /api/admin/hosting/accounts/:id/suspend` - Suspend account
- `POST /api/admin/hosting/accounts/:id/unsuspend` - Unsuspend account
- `POST /api/admin/hosting/accounts/:id/terminate` - Terminate account
- `PUT /api/admin/hosting/accounts/:id` - Update account details
- `GET /api/admin/hosting/accounts/stats` - Get statistics

## Security Notes

1. **Password Encryption**: WHM passwords are encrypted using AES-256-CBC before storage
2. **Environment Variable**: Always use a strong `ENCRYPTION_KEY` in production
3. **SSL Connection**: Always use SSL (port 2087) for WHM connections
4. **Admin Only**: All endpoints require admin authentication

## Troubleshooting

### Connection Failed

- Verify WHM host, username, and password
- Check if WHM port is correct (2087 for SSL, 2086 for non-SSL)
- Ensure your server IP is whitelisted in WHM
- Check firewall settings

### Sync Fails

- Verify WHM credentials are correct
- Check WHM API access permissions
- Ensure reseller account has proper permissions

### Accounts Not Showing

- Run "Sync from WHM" to import accounts
- Check account status filters
- Verify search query

## Support

For issues with:
- **WHM API**: Contact AsuraHosting support
- **System Issues**: Check server logs in `api/` directory
- **Database**: Verify migration completed successfully



