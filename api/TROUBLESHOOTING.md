# Database Connection Troubleshooting

## Error: "Too Many User Connections"

If you encounter the error:
```
Error: User fiveditc_fiveditv2 already has more than 'max_user_connections' active connections
```

This means your MySQL user has reached the maximum number of concurrent connections allowed.

## Common Causes

1. **API Server Running**: The API server maintains a connection pool. If it's running while you try to migrate/seed, you may hit the limit.

2. **Previous Scripts Not Closed**: If migration or seed scripts crashed or were interrupted, connections may still be open.

3. **Low Connection Limit**: Shared hosting often has low connection limits (e.g., 5-10 connections).

4. **Multiple Scripts Running**: Running multiple database scripts simultaneously.

## Solutions

### 1. Stop the API Server

If the API server is running, stop it first:

```bash
# Find and kill the API server process
pkill -f "node.*server.js"

# Or if using PM2
pm2 stop fivedit-api

# Or manually find the process
ps aux | grep "node.*server.js"
kill <PID>
```

### 2. Wait for Connections to Timeout

MySQL connections typically timeout after a few minutes. Wait 2-5 minutes and try again.

### 3. Check Active Connections

Use the connection checker script:

```bash
cd api
npm run check-connections
```

This will show:
- Number of active connections
- Connection details (ID, host, database, state)
- Max allowed connections

### 4. Close Idle Connections (Advanced)

If you have MySQL root access, you can close connections:

```bash
mysql -u root -p

# Show all connections for your user
SHOW PROCESSLIST;

# Kill specific connections (replace USER and ID)
KILL <connection_id>;

# Or kill all connections for a user (use with caution!)
# This requires SUPER privilege
```

### 5. Increase Connection Limit (Requires Hosting Admin)

If you have access to MySQL configuration:

```sql
-- Check current limit
SHOW VARIABLES LIKE 'max_user_connections';

-- Increase limit (requires SUPER privilege)
SET GLOBAL max_user_connections = 20;
```

**Note**: On shared hosting, you typically cannot change this. Contact your hosting provider.

### 6. Reduce Connection Pool Size

The connection pool in `api/config/database.js` is set to 5 connections. If you still hit limits, you can reduce it:

```javascript
connectionLimit: 3, // Reduce from 5 to 3
```

## Prevention

### Always Close Connections

The migration and seed scripts now properly close connections in the `finally` block. Make sure you:

1. Don't interrupt scripts (Ctrl+C) - let them finish
2. Wait for scripts to complete before running another
3. Stop the API server before running migrations/seeds

### Best Practices

1. **Run migrations/seeds when API is stopped**:
   ```bash
   # Stop API
   pkill -f "node.*server.js"
   
   # Run migration
   npm run migrate
   
   # Run seed
   npm run seed
   
   # Start API
   npm start
   ```

2. **Use connection checker before running scripts**:
   ```bash
   npm run check-connections
   ```

3. **Run scripts one at a time** - Don't run migrate and seed simultaneously.

## Script Improvements

All database scripts now include:

- ✅ Connection timeout handling
- ✅ Proper connection cleanup in `finally` blocks
- ✅ Helpful error messages for connection issues
- ✅ Connection status logging

## Quick Fix Checklist

When you get "too many connections" error:

- [ ] Stop the API server (`pkill -f "node.*server.js"`)
- [ ] Wait 2-5 minutes for connections to timeout
- [ ] Check connections: `npm run check-connections`
- [ ] Run migration/seed again
- [ ] If still failing, contact hosting provider about connection limits

## Contact Hosting Provider

If the issue persists, contact your hosting provider and ask:

1. What is the `max_user_connections` limit for my MySQL user?
2. Can it be increased?
3. Are there any idle connection timeouts configured?

Most shared hosting providers have limits around 5-10 connections per user.

