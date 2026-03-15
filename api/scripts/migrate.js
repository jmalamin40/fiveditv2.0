const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;
  
  try {
    console.log('Migrating database...',{
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000, // 10 second timeout
      multipleStatements: false, // Prevent multiple statements
    });
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

    // FCM tokens for push notifications (user = per session, admin = per admin)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NULL,
        admin_id INT NULL,
        token VARCHAR(500) NOT NULL,
        user_type ENUM('user', 'admin') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_token (token(255)),
        INDEX idx_session (session_id),
        INDEX idx_admin (admin_id),
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ FCM tokens table created');

    // Firebase config for push (service account for backend, client config for frontend)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS firebase_config (
        id INT PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN DEFAULT FALSE,
        service_account_json TEXT NULL,
        client_config_json TEXT NULL COMMENT 'Firebase web app config for FCM getToken',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Firebase config table created');

    try {
      await connection.execute(`ALTER TABLE firebase_config ADD COLUMN vapid_key VARCHAR(255) NULL AFTER client_config_json`);
      console.log('✅ firebase_config.vapid_key column added');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    // Cloudflare config for SMM subdomain DNS (create DNS record when user selects subdomain)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cloudflare_config (
        id INT PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN DEFAULT FALSE,
        api_token VARCHAR(500) NULL COMMENT 'Cloudflare API Token (recommended) or Global API Key',
        zone_id VARCHAR(100) NULL COMMENT 'Zone ID for the domain (e.g. fivedit.com)',
        base_domain VARCHAR(255) NULL COMMENT 'Root domain e.g. fivedit.com',
        record_type ENUM('A','CNAME') DEFAULT 'CNAME',
        target_value VARCHAR(255) NULL COMMENT 'A: IP address; CNAME: hostname e.g. fivedit.com',
        proxied BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Cloudflare config table created');

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

    // Create hosting_packages table (for managing hosting plans/pricing)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hosting_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        price_monthly DECIMAL(10, 2) NOT NULL,
        price_yearly DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        disk_space_gb INT NOT NULL,
        bandwidth_gb INT,
        domains INT,
        email_accounts INT,
        \`databases\` INT,
        ssl_included BOOLEAN DEFAULT TRUE,
        backups VARCHAR(50),
        support_type VARCHAR(50),
        cpanel BOOLEAN DEFAULT TRUE,
        wordpress BOOLEAN DEFAULT FALSE,
        php_version VARCHAR(10),
        nodejs BOOLEAN DEFAULT FALSE,
        python BOOLEAN DEFAULT FALSE,
        popular BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_popular (popular)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Hosting packages table created');

    // Create hosting_orders table (for payment orders)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hosting_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL UNIQUE,
        transaction_id VARCHAR(100),
        package_id INT NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        billing_period ENUM('monthly', 'yearly') NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        domain VARCHAR(255),
        username VARCHAR(100),
        status ENUM('pending', 'paid', 'failed', 'cancelled', 'completed') DEFAULT 'pending',
        payment_url VARCHAR(500),
        return_url VARCHAR(500),
        cancel_url VARCHAR(500),
        webhook_url VARCHAR(500),
        payment_gateway_response TEXT,
        hosting_account_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        FOREIGN KEY (package_id) REFERENCES hosting_packages(id) ON DELETE RESTRICT,
        FOREIGN KEY (hosting_account_id) REFERENCES hosting_accounts(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_transaction_id (transaction_id),
        INDEX idx_customer_email (customer_email),
        INDEX idx_order_id (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Hosting orders table created');

    // Add customer_id column to hosting_orders if it doesn't exist
    try {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'hosting_orders' 
        AND COLUMN_NAME = 'customer_id'
      `);
      
      if (columns.length === 0) {
        await connection.execute(`
          ALTER TABLE hosting_orders 
          ADD COLUMN customer_id INT NULL,
          ADD INDEX idx_customer_id (customer_id),
          ADD FOREIGN KEY (customer_id) REFERENCES customer_users(id) ON DELETE SET NULL
        `);
        console.log('✅ Added customer_id column to hosting_orders table');
      }
    } catch (error) {
      console.log('⚠️  customer_id column may already exist or error:', error.message);
    }

    // Create customer_users table (for customer portal authentication)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Customer users table created');

    // Create invoices table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        order_id INT NOT NULL,
        customer_id INT,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        customer_address TEXT,
        amount DECIMAL(10, 2) NOT NULL,
        tax_amount DECIMAL(10, 2) DEFAULT 0,
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
        due_date DATE,
        paid_at TIMESTAMP NULL,
        notes TEXT,
        invoice_items JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES hosting_orders(id) ON DELETE RESTRICT,
        FOREIGN KEY (customer_id) REFERENCES customer_users(id) ON DELETE SET NULL,
        INDEX idx_invoice_number (invoice_number),
        INDEX idx_order_id (order_id),
        INDEX idx_customer_id (customer_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Invoices table created');

    // SMM (Social Media Marketing) Website service tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smm_website_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        billing_interval VARCHAR(20) NULL COMMENT 'monthly | yearly',
        package_tier VARCHAR(50) NULL COMMENT 'starter | standard | premium',
        features JSON NULL COMMENT 'Array of feature strings for display',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0 COMMENT 'Display order: starter=1, standard=2, premium=3; monthly before yearly',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_package_tier (package_tier),
        INDEX idx_billing_interval (billing_interval)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ SMM website products table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smm_website_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL UNIQUE,
        product_id INT NOT NULL,
        transaction_id VARCHAR(100),
        customer_id INT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        domain VARCHAR(255) NULL,
        subdomain_slug VARCHAR(100) NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        status ENUM('pending', 'paid', 'failed', 'cancelled', 'completed') DEFAULT 'pending',
        payment_url VARCHAR(500),
        return_url VARCHAR(500),
        cancel_url VARCHAR(500),
        webhook_url VARCHAR(500),
        payment_gateway_response TEXT,
        tenant_id INT NULL COMMENT 'ID from tenants API after register_tenant',
        smm_instance_id INT NULL,
        one_time_login_token VARCHAR(64) NULL,
        one_time_login_expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        FOREIGN KEY (product_id) REFERENCES smm_website_products(id) ON DELETE RESTRICT,
        FOREIGN KEY (customer_id) REFERENCES customer_users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_transaction_id (transaction_id),
        INDEX idx_customer_email (customer_email),
        INDEX idx_customer_id (customer_id),
        INDEX idx_order_id (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ SMM website orders table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smm_provisioning_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL COMMENT 'smm_website_orders.id',
        step_name VARCHAR(64) NOT NULL COMMENT 'e.g. directadmin_domain, copy_files, supabase_project, supabase_schema, supabase_user, replace_config, insert_instance',
        step_order INT NOT NULL DEFAULT 0,
        status ENUM('pending', 'running', 'success', 'failed') DEFAULT 'pending',
        error_message TEXT NULL,
        details JSON NULL COMMENT 'Step output e.g. folder_path, supabase_url',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES smm_website_orders(id) ON DELETE CASCADE,
        INDEX idx_order_status (order_id, status),
        INDEX idx_order_steps (order_id, step_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ SMM provisioning steps table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smm_instances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL COMMENT 'smm_website_orders.id',
        domain VARCHAR(255) NOT NULL COMMENT 'Full domain: custom domain or subdomain e.g. user.fivedit.com',
        folder_name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Sanitized folder name under smm_instances',
        folder_path VARCHAR(500) NOT NULL COMMENT 'Relative path from project root',
        site_url VARCHAR(500) NOT NULL COMMENT 'Full URL for customer to access',
        customer_email VARCHAR(255) NOT NULL,
        status ENUM('pending', 'active', 'suspended') DEFAULT 'active',
        supabase_project_ref VARCHAR(50) NULL COMMENT 'Supabase project ref for auth magic link',
        supabase_project_response JSON NULL COMMENT 'Full Supabase create project API response',
        supabase_user_email VARCHAR(255) NULL COMMENT 'Supabase auth user email created for this instance',
        admin_password_encrypted TEXT NULL COMMENT 'Encrypted admin password for SMM site auto-login',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES smm_website_orders(id) ON DELETE CASCADE,
        INDEX idx_customer_email (customer_email),
        INDEX idx_folder_name (folder_name),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ SMM instances table created');

    // Add FK from smm_website_orders to smm_instances after table exists
    try {
      const [fkCheck] = await connection.execute(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'smm_website_orders'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME LIKE '%smm_instance%'
      `);
      if (fkCheck.length === 0) {
        await connection.execute(`
          ALTER TABLE smm_website_orders
          ADD CONSTRAINT fk_smm_order_instance
          FOREIGN KEY (smm_instance_id) REFERENCES smm_instances(id) ON DELETE SET NULL
        `);
        console.log('✅ Added smm_instance_id FK to smm_website_orders');
      }
    } catch (e) {
      if (!e.message || !e.message.includes('Duplicate')) console.log('⚠️ smm_website_orders FK:', e.message);
    }

    // Add optional columns to smm_website_orders (existing DBs)
    for (const col of [
      'ADD COLUMN tenant_id INT NULL COMMENT \'ID from tenants API after register_tenant\'',
      'ADD COLUMN one_time_login_token VARCHAR(64) NULL',
      'ADD COLUMN one_time_login_expires_at TIMESTAMP NULL',
    ]) {
      try {
        await connection.execute(`ALTER TABLE smm_website_orders ${col}`);
        console.log('✅ smm_website_orders: added', col.split(' ')[2]);
      } catch (e) {
        if (!e.message || !e.message.includes('Duplicate column')) console.log('⚠️ smm_website_orders alter:', e.message);
      }
    }

    // Add optional columns to smm_instances for Supabase (existing DBs)
    for (const col of [
      'ADD COLUMN supabase_project_ref VARCHAR(50) NULL',
      'ADD COLUMN supabase_project_response JSON NULL',
      'ADD COLUMN supabase_user_email VARCHAR(255) NULL',
      'ADD COLUMN admin_password_encrypted TEXT NULL',
    ]) {
      try {
        await connection.execute(`ALTER TABLE smm_instances ${col}`);
        console.log('✅ smm_instances: added', col.split(' ')[2]);
      } catch (e) {
        if (!e.message || !e.message.includes('Duplicate column')) console.log('⚠️ smm_instances alter:', e.message);
      }
    }

    // Domain reseller / domain sales
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS domain_reseller_config (
        id INT PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN DEFAULT FALSE,
        provider VARCHAR(50) NULL COMMENT 'e.g. resellerclub, namecheap, enom',
        api_url VARCHAR(500) NULL,
        api_key VARCHAR(255) NULL,
        api_secret VARCHAR(255) NULL,
        reseller_customer_id VARCHAR(100) NULL,
        default_currency VARCHAR(10) DEFAULT 'BDT',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ domain_reseller_config table created');

    try {
      await connection.execute(`ALTER TABLE domain_reseller_config ADD COLUMN use_sandbox BOOLEAN DEFAULT FALSE COMMENT 'Use Dynadot Sandbox (api-sandbox.dynadot.com) for testing'`);
      console.log('✅ domain_reseller_config.use_sandbox added');
    } catch (e) {
      if (!e.message || !e.message.includes('Duplicate column')) console.log('⚠️ domain_reseller_config use_sandbox:', e.message);
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS domain_tld_pricing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tld VARCHAR(32) NOT NULL UNIQUE COMMENT 'e.g. com, net, org',
        register_price DECIMAL(10, 2) NOT NULL,
        renew_price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ domain_tld_pricing table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS facebook_config (
        id INT PRIMARY KEY DEFAULT 1,
        pixel_enabled BOOLEAN DEFAULT FALSE,
        pixel_id VARCHAR(50) NULL COMMENT 'Facebook Pixel ID',
        pixel_access_token VARCHAR(500) NULL COMMENT 'Optional: for Conversions API server-side events',
        conv_api_enabled BOOLEAN DEFAULT FALSE,
        page_id VARCHAR(50) NULL COMMENT 'Facebook Page ID for Conversations API',
        page_access_token VARCHAR(500) NULL COMMENT 'Page Access Token for Conversations API / CAPI',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ facebook_config table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smm_config (
        id INT PRIMARY KEY DEFAULT 1,
        website_configuration_price DECIMAL(10, 2) NOT NULL DEFAULT 4999,
        website_configuration_currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ smm_config table created');
    await connection.execute(`
      INSERT INTO smm_config (id, website_configuration_price, website_configuration_currency)
      VALUES (1, 4999, 'BDT')
      ON DUPLICATE KEY UPDATE id = id
    `);

    const [configProduct] = await connection.execute(
      "SELECT id FROM smm_website_products WHERE name = 'smm-website-configuration' LIMIT 1"
    );
    if (configProduct.length === 0) {
      await connection.execute(`
        INSERT INTO smm_website_products (name, display_name, description, price, currency, billing_interval, package_tier, sort_order, is_active)
        VALUES ('smm-website-configuration', 'SMM Website Configuration', 'One-time setup and configuration of your SMM website.', 4999, 'BDT', NULL, NULL, 0, TRUE)
      `);
      console.log('✅ SMM Website Configuration product seeded');
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smtp_config (
        id INT PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN DEFAULT FALSE,
        host VARCHAR(255) NULL DEFAULT 'smtp.gmail.com',
        port INT NULL DEFAULT 587,
        secure BOOLEAN DEFAULT FALSE,
        user VARCHAR(255) NULL,
        password_encrypted TEXT NULL,
        from_address VARCHAR(255) NULL COMMENT 'From email e.g. noreply@example.com',
        cc_addresses TEXT NULL COMMENT 'Comma-separated CC emails',
        require_tls BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ smtp_config table created');
    try {
      await connection.execute(`ALTER TABLE smtp_config ADD COLUMN cc_addresses TEXT NULL COMMENT 'Comma-separated CC emails' AFTER from_address`);
      console.log('✅ smtp_config.cc_addresses column added');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        company VARCHAR(255) NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ contact_inquiries table created');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS traffic_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        path VARCHAR(500) NOT NULL DEFAULT '/',
        referrer VARCHAR(1000) NULL,
        referrer_domain VARCHAR(255) NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'direct' COMMENT 'direct|referral|search|social|email',
        utm_source VARCHAR(255) NULL,
        utm_medium VARCHAR(255) NULL,
        utm_campaign VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_source (source),
        INDEX idx_referrer_domain (referrer_domain)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ traffic_events table created');

    for (const col of [
      'ADD COLUMN new_domain_name VARCHAR(255) NULL COMMENT \'Domain to register when user purchases new domain\'',
      'ADD COLUMN domain_price DECIMAL(10, 2) NULL',
      'ADD COLUMN domain_currency VARCHAR(10) NULL',
    ]) {
      try {
        await connection.execute(`ALTER TABLE smm_website_orders ${col}`);
        console.log('✅ smm_website_orders: added', col.split(' ')[2]);
      } catch (e) {
        if (!e.message || !e.message.includes('Duplicate column')) console.log('⚠️ smm_website_orders alter:', e.message);
      }
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS domain_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL UNIQUE,
        domain_name VARCHAR(255) NOT NULL,
        tld VARCHAR(32) NOT NULL,
        register_price DECIMAL(10, 2) NOT NULL,
        renew_price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'BDT',
        customer_id INT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'paid', 'failed', 'cancelled', 'completed', 'registered') DEFAULT 'pending',
        transaction_id VARCHAR(100) NULL,
        payment_url VARCHAR(500) NULL,
        return_url VARCHAR(500) NULL,
        cancel_url VARCHAR(500) NULL,
        payment_gateway_response TEXT NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer_users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_customer_email (customer_email),
        INDEX idx_order_id (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ domain_orders table created');

    // Add optional columns to smm_website_products for packages (existing DBs)
    for (const col of [
      'ADD COLUMN billing_interval VARCHAR(20) NULL COMMENT \'monthly | yearly\'',
      'ADD COLUMN package_tier VARCHAR(50) NULL COMMENT \'starter | standard | premium\'',
      'ADD COLUMN features JSON NULL',
      'ADD COLUMN sort_order INT DEFAULT 0',
    ]) {
      try {
        await connection.execute(`ALTER TABLE smm_website_products ${col}`);
        console.log('✅ smm_website_products: added', col.split(' ')[2]);
      } catch (e) {
        if (!e.message || !e.message.includes('Duplicate column')) console.log('⚠️ smm_website_products alter:', e.message);
      }
    }

    // Seed SMM packages: Starter, Standard, Premium (each monthly + yearly)
    // const { seedSmmPackages } = require('./seedSmmPackages');
    // await seedSmmPackages(connection);

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

