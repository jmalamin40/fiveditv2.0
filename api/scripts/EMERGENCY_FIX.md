# Emergency Fix: Too Many Connections

If you're completely locked out due to too many connections, try these solutions in order:

## Solution 1: Stop All Node Processes (Recommended)

```bash
# Find all Node.js processes
ps aux | grep node

# Kill all Node.js processes (including API server)
pkill -9 node

# Or more specifically, kill API server
pkill -9 -f "server.js"
pkill -9 -f "nodemon"

# Wait 30 seconds
sleep 30

# Try migration again
npm run migrate
```

## Solution 2: Use Connection Cleanup Script

```bash
# Try to close idle connections
npm run close-connections

# If successful, try migration
npm run migrate
```

## Solution 3: Direct MySQL Access (If Available)

If you have MySQL command-line access:

```bash
# Connect to MySQL
mysql -u root -p -h localhost

# Or with your credentials
mysql -u fiveditc_fiveditv2 -p -h localhost
```

Then in MySQL:

```sql
-- Show all connections
SHOW PROCESSLIST;

-- Kill specific connections (replace ID with actual connection ID)
KILL 12345;
KILL 12346;
-- ... repeat for each connection

-- Or kill all connections for your user (use with caution!)
-- This requires SUPER privilege
SELECT CONCAT('KILL ', ID, ';') 
FROM information_schema.PROCESSLIST 
WHERE USER = 'fiveditc_fiveditv2' 
AND ID != CONNECTION_ID();
```

## Solution 4: Wait and Retry

Sometimes the simplest solution:

```bash
# Wait 5 minutes for connections to timeout
echo "Waiting 5 minutes for connections to timeout..."
sleep 300

# Try again
npm run migrate
```

## Solution 5: Contact Hosting Provider

If nothing works, contact your hosting provider and ask them to:

1. **Kill all connections** for your MySQL user
2. **Increase max_user_connections** limit (if possible)
3. **Check for connection leaks** in other applications

## Prevention After Fix

Once you get it working:

1. **Always stop API server before migrations**:
   ```bash
   pkill -f "node.*server.js"
   npm run migrate
   npm run seed
   npm start  # Start API again
   ```

2. **Check connections before running scripts**:
   ```bash
   npm run check-connections
   ```

3. **Use connection cleanup if needed**:
   ```bash
   npm run close-connections
   ```

## Quick Command Reference

```bash
# Stop everything
pkill -9 node

# Wait
sleep 60

# Cleanup connections
npm run close-connections

# Run migration
npm run migrate

# Run seed
npm run seed

# Start API
npm start
```

