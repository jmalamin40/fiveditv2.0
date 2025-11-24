const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seed() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fivedit_db',
      port: process.env.DB_PORT || 3306,
    });

    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE plan_features');
    await connection.execute('TRUNCATE TABLE service_plans');
    await connection.execute('TRUNCATE TABLE script_plans');
    await connection.execute('TRUNCATE TABLE reviews');
    await connection.execute('TRUNCATE TABLE services');
    await connection.execute('TRUNCATE TABLE codecanyon_scripts');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Cleared existing data\n');

    // Seed Services
    const servicesPath = path.join(__dirname, '../../data/services.json');
    const servicesData = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
    
    for (const service of servicesData.services) {
      // Load detailed service data if exists
      const serviceDetailPath = path.join(__dirname, `../../data/services/${service.id}.json`);
      let serviceDetail = null;
      
      if (fs.existsSync(serviceDetailPath)) {
        serviceDetail = JSON.parse(fs.readFileSync(serviceDetailPath, 'utf8'));
      }

      const serviceData = serviceDetail || service;
      
      await connection.execute(
        `INSERT INTO services (id, icon, title, short, description, features, color, category, link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serviceData.id,
          serviceData.icon,
          serviceData.title,
          serviceData.short,
          serviceData.description,
          JSON.stringify(serviceData.features || []),
          serviceData.color,
          serviceData.category,
          serviceData.link
        ]
      );

      // Insert plans if they exist
      if (serviceData.plans && Array.isArray(serviceData.plans)) {
        for (const plan of serviceData.plans) {
          const [planResult] = await connection.execute(
            `INSERT INTO service_plans (service_id, plan_id, name, price, currency, description, delivery_time, popular)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              serviceData.id,
              plan.id,
              plan.name,
              plan.price,
              plan.currency || 'USD',
              plan.description,
              plan.deliveryTime,
              plan.popular || false
            ]
          );

          const planId = planResult.insertId;

          // Insert plan features
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
    console.log(`✅ Seeded ${servicesData.services.length} services\n`);

    // Seed Reviews
    const reviewsPath = path.join(__dirname, '../../data/fiverr-reviews.json');
    const reviewsData = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
    
    for (const review of reviewsData.reviews) {
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
    console.log(`✅ Seeded ${reviewsData.reviews.length} reviews\n`);

    // Seed CodeCanyon Scripts
    const scriptsPath = path.join(__dirname, '../../data/codecanyon-scripts.json');
    const scriptsData = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));
    
    for (const script of scriptsData.scripts) {
      // Load detailed script data if exists
      const scriptDetailPath = path.join(__dirname, `../../data/codecanyon/scripts/${script.id}.json`);
      let scriptDetail = null;
      
      if (fs.existsSync(scriptDetailPath)) {
        scriptDetail = JSON.parse(fs.readFileSync(scriptDetailPath, 'utf8'));
      }

      const scriptData = scriptDetail || script;
      
      await connection.execute(
        `INSERT INTO codecanyon_scripts (id, name, category, short_description, description, codecanyon_url, image_url, use_default_plans)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scriptData.id,
          scriptData.name,
          scriptData.category,
          scriptData.shortDescription,
          scriptData.description,
          scriptData.codecanyonUrl,
          scriptData.imageUrl || '',
          scriptData.useDefaultPlans !== false
        ]
      );

      // Insert plans if they exist
      if (scriptData.plans && Array.isArray(scriptData.plans)) {
        for (const plan of scriptData.plans) {
          const [planResult] = await connection.execute(
            `INSERT INTO script_plans (script_id, plan_id, name, price, currency, description, delivery_time, popular)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              scriptData.id,
              plan.id,
              plan.name,
              plan.price,
              plan.currency || 'USD',
              plan.description,
              plan.deliveryTime,
              plan.popular || false
            ]
          );

          const planId = planResult.insertId;

          // Insert plan features
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
    console.log(`✅ Seeded ${scriptsData.scripts.length} CodeCanyon scripts\n`);

    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();

