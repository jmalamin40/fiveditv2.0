const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const {
  categories,
  services,
  scripts,
  reviews,
  adminUser
} = require('./seed-data');

async function seed() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fivedit_db',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000, // 10 second timeout
      multipleStatements: false, // Prevent multiple statements
    });

    console.log('✅ Connected to database');
    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE plan_features');
    await connection.execute('TRUNCATE TABLE service_plans');
    await connection.execute('TRUNCATE TABLE script_plans');
    await connection.execute('TRUNCATE TABLE reviews');
    await connection.execute('TRUNCATE TABLE services');
    await connection.execute('TRUNCATE TABLE codecanyon_scripts');
    await connection.execute('TRUNCATE TABLE categories');
    await connection.execute('TRUNCATE TABLE users');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Cleared existing data\n');

    // Seed categories
    for (const category of categories) {
      await connection.execute(
        `INSERT INTO categories (id, name, slug, description)
         VALUES (?, ?, ?, ?)`,
        [
          category.id,
          category.name,
          category.slug,
          category.description || null
        ]
      );
    }
    console.log(`✅ Seeded ${categories.length} categories\n`);

    // Seed services
    for (const service of services) {
      await connection.execute(
        `INSERT INTO services (id, icon, title, short, description, features, color, category, category_id, link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          service.id,
          service.icon,
          service.title,
          service.short,
          service.description,
          JSON.stringify(service.features || []),
          service.color,
          service.categoryName || null,
          service.categoryId || null,
          service.link || null
        ]
      );

      if (service.plans && Array.isArray(service.plans)) {
        for (const plan of service.plans) {
          const [planResult] = await connection.execute(
            `INSERT INTO service_plans (service_id, plan_id, name, price, currency, description, delivery_time, popular)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              service.id,
              plan.id,
              plan.name,
              plan.price,
              plan.currency || 'USD',
              plan.description || '',
              plan.deliveryTime || '',
              plan.popular || false
            ]
          );

          const planId = planResult.insertId;

          if (plan.features && Array.isArray(plan.features)) {
            for (const feature of plan.features) {
              await connection.execute(
                `INSERT INTO plan_features (plan_id, plan_type, name, included)
                 VALUES (?, 'service', ?, ?)`,
                [planId, feature.name, feature.included !== false]
              );
            }
          }
        }
      }
    }
    console.log(`✅ Seeded ${services.length} services\n`);

    // Seed CodeCanyon scripts
    for (const script of scripts) {
      await connection.execute(
        `INSERT INTO codecanyon_scripts (id, name, category, short_description, description, codecanyon_url, image_url, use_default_plans)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          script.id,
          script.name,
          script.category || null,
          script.shortDescription || null,
          script.description || null,
          script.codecanyonUrl || null,
          script.imageUrl || '',
          script.useDefaultPlans !== false
        ]
      );

      if (script.plans && Array.isArray(script.plans)) {
        for (const plan of script.plans) {
          const [planResult] = await connection.execute(
            `INSERT INTO script_plans (script_id, plan_id, name, price, currency, description, delivery_time, popular)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              script.id,
              plan.id,
              plan.name,
              plan.price,
              plan.currency || 'USD',
              plan.description || '',
              plan.deliveryTime || '',
              plan.popular || false
            ]
          );

          const planId = planResult.insertId;

          if (plan.features && Array.isArray(plan.features)) {
            for (const feature of plan.features) {
              await connection.execute(
                `INSERT INTO plan_features (plan_id, plan_type, name, included)
                 VALUES (?, 'script', ?, ?)`,
                [planId, feature.name, feature.included !== false]
              );
            }
          }
        }
      }
    }
    console.log(`✅ Seeded ${scripts.length} CodeCanyon scripts\n`);

    // Seed reviews
    for (const review of reviews) {
      await connection.execute(
        `INSERT INTO reviews (reviewer_name, reviewer_initial, location, country_code, is_repeat_client, rating, time_posted, review_text, price_range, duration, helpful_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          review.reviewerName,
          review.reviewerInitial,
          review.location,
          review.countryCode,
          review.isRepeatClient || false,
          review.rating,
          review.timePosted,
          review.reviewText,
          review.priceRange,
          review.duration,
          review.helpfulCount || 0
        ]
      );
    }
    console.log(`✅ Seeded ${reviews.length} reviews\n`);

    // Seed default admin user
    const passwordHash = await bcrypt.hash(adminUser.password, 10);
    await connection.execute(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [adminUser.name, adminUser.email, passwordHash, 'admin']
    );
    console.log(`✅ Created default admin user (${adminUser.email})\n`);

    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    
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

module.exports = seed;

if (require.main === module) {
  seed();
}

