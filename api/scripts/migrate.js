const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;
  
  try {
    // Connect to MySQL (without database first)
    // Use connectionLimit: 1 to avoid creating multiple connections
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000, // 10 second timeout
      multipleStatements: false, // Prevent multiple statements
    });
    
    console.log('✅ Connected to MySQL server');

    const dbName = process.env.DB_NAME || 'fivedit_db';

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created or already exists`);

    // Switch to the database
    await connection.execute(`USE \`${dbName}\``);

    // Create categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Categories table created');

    // Create services table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(100) PRIMARY KEY,
        icon VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        short TEXT,
        description TEXT,
        features JSON,
        color VARCHAR(20),
        category VARCHAR(100),
        category_id VARCHAR(100),
        link VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        INDEX idx_category_id (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Services table created');

    // Create service_plans table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS service_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_id VARCHAR(100) NOT NULL,
        plan_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        description TEXT,
        delivery_time VARCHAR(100),
        popular BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE KEY unique_service_plan (service_id, plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Service plans table created');

    // Create plan_features table (supports both service and script plans)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS plan_features (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        plan_type ENUM('service', 'script') NOT NULL,
        name VARCHAR(255) NOT NULL,
        included BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_plan (plan_id, plan_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Plan features table created');

    // Create reviews table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reviewer_name VARCHAR(255) NOT NULL,
        reviewer_initial VARCHAR(10) NOT NULL,
        location VARCHAR(255) NOT NULL,
        country_code VARCHAR(10) NOT NULL,
        is_repeat_client BOOLEAN DEFAULT FALSE,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        time_posted VARCHAR(100),
        review_text TEXT NOT NULL,
        price_range VARCHAR(100),
        duration VARCHAR(100),
        helpful_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rating (rating),
        INDEX idx_repeat_client (is_repeat_client),
        INDEX idx_country (country_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Reviews table created');

    // Create codecanyon_scripts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS codecanyon_scripts (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        short_description TEXT,
        description TEXT,
        codecanyon_url VARCHAR(500),
        image_url VARCHAR(500),
        use_default_plans BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ CodeCanyon scripts table created');

    // Create script_plans table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS script_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        script_id VARCHAR(100) NOT NULL,
        plan_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        description TEXT,
        delivery_time VARCHAR(100),
        popular BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES codecanyon_scripts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_script_plan (script_id, plan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Script plans table created');

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        profile_picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Users table created');

    // Create chat_sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_identifier VARCHAR(255),
        status ENUM('active', 'closed', 'pending') DEFAULT 'active',
        is_new_traffic BOOLEAN DEFAULT TRUE,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_last_message (last_message_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Chat sessions table created');

    // Create chat_messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        message TEXT NOT NULL,
        sender_type ENUM('user', 'admin') NOT NULL,
        sender_id INT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
        INDEX idx_session (session_id),
        INDEX idx_created (created_at),
        INDEX idx_read (is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Chat messages table created');

    // Create user_online_status table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_online_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36),
        user_id INT,
        user_type ENUM('user', 'admin') NOT NULL,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_session_user (session_id, user_id, user_type),
        INDEX idx_last_seen (last_seen),
        INDEX idx_is_online (is_online)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ User online status table created');

    // Create hosting_accounts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hosting_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        domain VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        package_name VARCHAR(100) NOT NULL,
        status ENUM('active', 'suspended', 'terminated', 'pending') DEFAULT 'pending',
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        disk_used DECIMAL(10, 2) DEFAULT 0,
        disk_limit DECIMAL(10, 2) DEFAULT 0,
        bandwidth_used DECIMAL(10, 2) DEFAULT 0,
        bandwidth_limit DECIMAL(10, 2) DEFAULT 0,
        ip_address VARCHAR(45),
        cpanel_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        suspended_at TIMESTAMP NULL,
        notes TEXT,
        whm_account_id INT,
        INDEX idx_status (status),
        INDEX idx_domain (domain),
        INDEX idx_username (username),
        INDEX idx_customer_email (customer_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Hosting accounts table created');

    // Create hosting_config table (stores WHM credentials and settings)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hosting_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        whm_host VARCHAR(255) NOT NULL,
        whm_username VARCHAR(100) NOT NULL,
        whm_password_encrypted TEXT NOT NULL,
        whm_port INT DEFAULT 2087,
        whm_ssl BOOLEAN DEFAULT TRUE,
        reseller_username VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_config (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Hosting config table created');

    console.log('\n🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // If it's a connection limit error, provide helpful message
    if (error.code === 'ER_TOO_MANY_USER_CONNECTIONS') {
      console.error('\n⚠️  Too many database connections active.');
      console.error('   This usually means:');
      console.error('   1. The API server is running and holding connections');
      console.error('   2. Previous migration/seed scripts didn\'t close connections');
      console.error('   3. Database connection limit is too low\n');
      console.error('   Solutions:');
      console.error('   - Stop the API server: pkill -f "node.*server.js"');
      console.error('   - Wait a few minutes for connections to timeout');
      console.error('   - Contact your hosting provider to increase max_user_connections');
      console.error('   - Or run: mysql -u root -p -e "KILL USER \'' + (process.env.DB_USER || 'root') + '\'@\'%\';"');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('✅ Database connection closed');
      } catch (err) {
        console.error('⚠️  Error closing connection:', err.message);
      }
    }
  }
}

migrate();

