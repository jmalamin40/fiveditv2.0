/**
 * Seed SMM packages: Starter, Standard, Premium (each with monthly and yearly).
 * Run from migrate.js. Idempotent: updates existing rows by name or inserts new ones.
 */

const SMM_PACKAGES = [
  // ---- STARTER ----
  {
    name: 'smm-starter-monthly',
    display_name: 'Starter (Monthly)',
    package_tier: 'starter',
    billing_interval: 'monthly',
    description: 'Full ecommerce stack with Node.js + React. AI support, real-time notifications, bKash/Nagad/SSLCommerce, SMTP & easy checkout. Perfect to launch fast.',
    price: 2999,
    currency: 'BDT',
    sort_order: 1,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
    ],
  },
  {
    name: 'smm-starter-yearly',
    display_name: 'Starter (Yearly)',
    package_tier: 'starter',
    billing_interval: 'yearly',
    description: 'Same as Starter with 2 months free. Full ecommerce, AI, real-time notifications, bKash/Nagad/SSLCommerce, SMTP & easy checkout.',
    price: 29990,
    currency: 'BDT',
    sort_order: 2,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
      'Save 2 months (pay 10, get 12)',
    ],
  },
  // ---- STANDARD ----
  {
    name: 'smm-standard-monthly',
    display_name: 'Standard (Monthly)',
    package_tier: 'standard',
    billing_interval: 'monthly',
    description: 'Everything in Starter plus dedicated database and self server. More control and performance for growing stores.',
    price: 5999,
    currency: 'BDT',
    sort_order: 3,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
      'Dedicated database',
      'Self server',
    ],
  },
  {
    name: 'smm-standard-yearly',
    display_name: 'Standard (Yearly)',
    package_tier: 'standard',
    billing_interval: 'yearly',
    description: 'Same as Standard with 2 months free. Dedicated database and self server for serious sellers.',
    price: 59990,
    currency: 'BDT',
    sort_order: 4,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
      'Dedicated database',
      'Self server',
      'Save 2 months (pay 10, get 12)',
    ],
  },
  // ---- PREMIUM ----
  {
    name: 'smm-premium-monthly',
    display_name: 'Premium (Monthly)',
    package_tier: 'premium',
    billing_interval: 'monthly',
    description: 'Top tier: everything in Standard plus VPS. Full control, maximum performance and scalability for high-volume stores.',
    price: 12999,
    currency: 'BDT',
    sort_order: 5,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
      'Dedicated database',
      'VPS',
    ],
  },
  {
    name: 'smm-premium-yearly',
    display_name: 'Premium (Yearly)',
    package_tier: 'premium',
    billing_interval: 'yearly',
    description: 'Same as Premium with 2 months free. VPS and dedicated database for scaling without limits.',
    price: 129990,
    currency: 'BDT',
    sort_order: 6,
    features: [
      'Backend Node.js',
      'Frontend React.js',
      'Complete Ecommerce',
      'AI supported',
      'Real-time push notification',
      'Payment gateway: bKash, Nagad, SSLCommerce',
      'SMTP supported',
      'Easy checkout',
      'Dedicated database',
      'VPS',
      'Save 2 months (pay 10, get 12)',
    ],
  },
];

async function seedSmmPackages(connection) {
  const [existing] = await connection.execute(
    'SELECT id, name FROM smm_website_products WHERE name = ?',
    ['smm-website']
  );

  // If legacy single product exists, convert it to starter-monthly so we keep one row and add 5
  if (existing.length > 0) {
    const p = SMM_PACKAGES.find((x) => x.name === 'smm-starter-monthly');
    await connection.execute(
      `UPDATE smm_website_products SET
        name = ?, display_name = ?, description = ?, price = ?, currency = ?,
        billing_interval = ?, package_tier = ?, features = ?, sort_order = ?, is_active = TRUE
       WHERE name = 'smm-website'`,
      [
        p.name,
        p.display_name,
        p.description,
        p.price,
        p.currency,
        p.billing_interval,
        p.package_tier,
        JSON.stringify(p.features),
        p.sort_order,
      ]
    );
    console.log('✅ SMM: converted smm-website to smm-starter-monthly');
  }

  for (const p of SMM_PACKAGES) {
    const [rows] = await connection.execute(
      'SELECT id FROM smm_website_products WHERE name = ?',
      [p.name]
    );
    const featuresJson = JSON.stringify(p.features);
    if (rows.length === 0) {
      await connection.execute(
        `INSERT INTO smm_website_products
         (name, display_name, description, price, currency, billing_interval, package_tier, features, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          p.name,
          p.display_name,
          p.description,
          p.price,
          p.currency,
          p.billing_interval,
          p.package_tier,
          featuresJson,
          p.sort_order,
        ]
      );
      console.log('✅ SMM package added:', p.name);
    } else {
      await connection.execute(
        `UPDATE smm_website_products SET
          display_name = ?, description = ?, price = ?, currency = ?,
          billing_interval = ?, package_tier = ?, features = ?, sort_order = ?
         WHERE name = ?`,
        [
          p.display_name,
          p.description,
          p.price,
          p.currency,
          p.billing_interval,
          p.package_tier,
          featuresJson,
          p.sort_order,
          p.name,
        ]
      );
      console.log('✅ SMM package updated:', p.name);
    }
  }

  console.log('✅ SMM packages seed done (Starter, Standard, Premium × Monthly/Yearly)');
}

module.exports = { seedSmmPackages, SMM_PACKAGES };
