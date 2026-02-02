# Docker Setup Guide

This guide explains how to run the FivedIT application using Docker Compose with MariaDB 10.6.16 and phpMyAdmin.

## Prerequisites

- Docker installed on your system
- Docker Compose installed

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.docker.example .env.docker
   ```

2. **Update `.env.docker` with your configuration:**
   - Set database passwords
   - Set JWT secret
   - Set encryption key for hosting management

3. **Start all services (MariaDB + phpMyAdmin):**
   ```bash
   docker-compose up -d
   ```

4. **Wait for MariaDB to be ready** (check logs):
   ```bash
   docker-compose logs -f mariadb
   ```
   Wait for: `ready for connections`

5. **Access phpMyAdmin:**
   - Open browser: `http://localhost:8080`
   - Login with:
     - **Server**: `mariadb` (or leave default)
     - **Username**: `fivedit_user` (or your DB_USER)
     - **Password**: `fivedit_password` (or your DB_PASSWORD)

5. **Update your API `.env` file** to use Docker database:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=fivedit_user
   DB_PASSWORD=fivedit_password
   DB_NAME=fivedit_db
   ```

6. **Run migrations:**
   ```bash
   cd api
   npm run migrate
   ```

7. **Seed database (optional):**
   ```bash
   cd api
   npm run seed
   ```

8. **Start API server:**
   ```bash
   cd api
   npm run dev
   ```

## Docker Compose Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f mariadb
```

### Stop and remove volumes (⚠️ deletes all data)
```bash
docker-compose down -v
```

### Access MariaDB CLI
```bash
docker-compose exec mariadb mysql -u fivedit_user -p fivedit_db
```

### Access phpMyAdmin
- Open browser: `http://localhost:8080`
- Default login:
  - **Server**: `mariadb`
  - **Username**: `fivedit_user`
  - **Password**: `fivedit_password`

### Backup database
```bash
docker-compose exec mariadb mysqldump -u fivedit_user -p fivedit_db > backup.sql
```

### Restore database
```bash
docker-compose exec -T mariadb mysql -u fivedit_user -p fivedit_db < backup.sql
```

## Configuration

### MariaDB Version
- **Version**: 10.6.16
- **Port**: 3306 (mapped to host)
- **Character Set**: utf8mb4
- **Collation**: utf8mb4_unicode_ci

### Default Credentials
- **Root Password**: Set in `.env.docker` as `DB_ROOT_PASSWORD`
- **Database User**: Set in `.env.docker` as `DB_USER`
- **Database Password**: Set in `.env.docker` as `DB_PASSWORD`
- **Database Name**: Set in `.env.docker` as `DB_NAME`

### Data Persistence
Database data is stored in a Docker volume `mariadb_data` and persists even if the container is stopped.

## Troubleshooting

### Port Already in Use

**MariaDB port conflict:**
If port 3306 is already in use, change it in `docker-compose.yml`:
```yaml
ports:
  - "3307:3306"  # Use 3307 on host instead
```

Then update your API `.env`:
```env
DB_PORT=3307
```

**phpMyAdmin port conflict:**
If port 8080 is already in use, change it in `docker-compose.yml`:
```yaml
ports:
  - "8081:80"  # Use 8081 on host instead
```

Or set in `.env.docker`:
```env
PMA_PORT=8081
```

### Connection Refused
1. Check if container is running: `docker-compose ps`
2. Check logs: `docker-compose logs mariadb`
3. Verify database is ready: `docker-compose exec mariadb mysqladmin ping -u root -p`

### Reset Database
To completely reset the database:
```bash
docker-compose down -v
docker-compose up -d mariadb
# Wait for MariaDB to start, then run migrations again
```

## Production Notes

⚠️ **Do NOT use this Docker setup in production without:**
- Strong passwords
- Proper security configuration
- Network isolation
- Regular backups
- SSL/TLS encryption

For production, use a managed database service or properly configured MariaDB server.

