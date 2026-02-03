# Logging Guide

## Overview

The application now uses file-based logging for production environments. All logs are written to files in the `api/logs/` directory.

## Log Files

Logs are organized by type and date:

- **`sync-YYYY-MM-DD.log`** - DirectAdmin account sync operations
- **`directadmin-YYYY-MM-DD.log`** - DirectAdmin API requests and responses
- **`app-YYYY-MM-DD.log`** - General application logs

## Viewing Logs

### In Production (cPanel/SSH)

1. **SSH into your server:**
   ```bash
   ssh your_username@your_server
   ```

2. **Navigate to logs directory:**
   ```bash
   cd ~/domains/yourdomain.com/api/logs
   ```

3. **View today's sync logs:**
   ```bash
   tail -f sync-$(date +%Y-%m-%d).log
   ```

4. **View today's DirectAdmin logs:**
   ```bash
   tail -f directadmin-$(date +%Y-%m-%d).log
   ```

5. **View all logs:**
   ```bash
   tail -f *.log
   ```

### View Last 100 Lines

```bash
tail -n 100 sync-$(date +%Y-%m-%d).log
```

### Search Logs

```bash
# Search for errors
grep ERROR sync-*.log

# Search for specific username
grep "php83" sync-*.log

# Search for today's sync
grep "Starting DirectAdmin account sync" sync-$(date +%Y-%m-%d).log
```

## Log Levels

- **INFO** - General information (always logged)
- **WARN** - Warnings (always logged)
- **ERROR** - Errors (always logged)
- **DEBUG** - Debug information (only in development or when `DEBUG=true`)

## Log Format

Each log entry includes:
- Timestamp (ISO format)
- Log level
- Message
- Optional data (JSON format)

Example:
```
[2024-01-15T10:30:45.123Z] [INFO] Starting DirectAdmin account sync
[2024-01-15T10:30:45.456Z] [INFO] Configuration loaded: {"whm_host":"localhost","whm_port":2222}
```

## Troubleshooting

### Logs Not Appearing

1. **Check directory permissions:**
   ```bash
   ls -la api/logs/
   chmod -R 755 api/logs/
   ```

2. **Check if logs directory exists:**
   ```bash
   ls -la api/logs/
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

### Log Files Too Large

Logs are created daily. Old logs can be archived or deleted:

```bash
# Archive old logs (older than 30 days)
find api/logs/ -name "*.log" -mtime +30 -exec gzip {} \;

# Delete old logs (older than 90 days)
find api/logs/ -name "*.log" -mtime +90 -delete
```

## Log Rotation (Optional)

For production, consider setting up log rotation using `logrotate`:

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/fivedit-api
```

Add:
```
/path/to/api/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 user group
}
```




