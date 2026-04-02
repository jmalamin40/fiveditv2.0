const express = require('express');
const slugify = require('slugify');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

async function getServiceWithPlans(serviceId) {
  const [services] = await pool.execute(
    'SELECT * FROM services WHERE id = ? LIMIT 1',
    [serviceId]
  );

  if (services.length === 0) {
    return null;
  }

  const service = services[0];

  const [plans] = await pool.execute(
    'SELECT * FROM service_plans WHERE service_id = ? ORDER BY price ASC',
    [serviceId]
  );

  const plansWithFeatures = await Promise.all(
    plans.map(async (plan) => {
      const [features] = await pool.execute(
        'SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = \'service\' ORDER BY id',
        [plan.id]
      );
      return { ...plan, features };
    })
  );

  return {
    ...service,
    features: Array.isArray(service.features) ? service.features : JSON.parse(service.features || '[]'),
    plans: plansWithFeatures,
  };
}

async function deleteServicePlans(serviceId) {
  const [planRows] = await pool.execute(
    'SELECT id FROM service_plans WHERE service_id = ?',
    [serviceId]
  );

  const planIds = planRows.map((plan) => plan.id);
  if (planIds.length > 0) {
    const placeholders = planIds.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM plan_features WHERE plan_id IN (${placeholders}) AND plan_type = 'service'`,
      planIds
    );
  }

  await pool.execute('DELETE FROM service_plans WHERE service_id = ?', [serviceId]);
}

async function insertServicePlans(serviceId, plans = []) {
  for (const plan of plans) {
    const planIdValue = (plan.id ?? plan.plan_id ?? '').toString().trim();
    const delivery = (plan.deliveryTime ?? plan.delivery_time ?? '').toString();
    const priceValue = Number(plan.price);
    const popularValue =
      plan.popular === true ||
      plan.popular === 1 ||
      plan.popular === '1' ||
      plan.popular === 'true';

    const [planResult] = await pool.execute(
      `INSERT INTO service_plans (service_id, plan_id, name, price, currency, description, delivery_time, popular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        planIdValue || slugify((plan.name || 'plan').toString(), { lower: true, strict: true }),
        (plan.name || '').toString(),
        Number.isFinite(priceValue) ? priceValue : 0,
        (plan.currency || 'USD').toString(),
        (plan.description || '').toString(),
        delivery,
        popularValue,
      ]
    );

    const planId = planResult.insertId;
    if (plan.features && Array.isArray(plan.features)) {
      for (const feature of plan.features) {
        await pool.execute(
          `INSERT INTO plan_features (plan_id, plan_type, name, included)
           VALUES (?, 'service', ?, ?)`,
          [
            planId,
            (feature?.name || '').toString(),
            !(feature?.included === false || feature?.included === 0 || feature?.included === '0' || feature?.included === 'false'),
          ]
        );
      }
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const [services] = await pool.execute('SELECT id FROM services ORDER BY title');
    const results = [];
    for (const service of services) {
      const fullService = await getServiceWithPlans(service.id);
      if (fullService) {
        results.push(fullService);
      }
    }
    res.json(results);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const service = await getServiceWithPlans(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      icon,
      title,
      short,
      description,
      features = [],
      color = 'blue',
      categoryId,
      link,
      plans = [],
    } = req.body;

    if (!title || !icon) {
      return res.status(400).json({ error: 'Title and icon are required' });
    }

    const serviceId = id || slugify(title, { lower: true, strict: true });

    const [existing] = await pool.execute('SELECT id FROM services WHERE id = ?', [serviceId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Service ID already exists' });
    }

    let categoryName = null;
    if (categoryId) {
      const [categoryRows] = await pool.execute('SELECT name FROM categories WHERE id = ? LIMIT 1', [categoryId]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: 'Invalid categoryId' });
      }
      categoryName = categoryRows[0].name;
    }

    await pool.execute(
      `INSERT INTO services (id, icon, title, short, description, features, color, category, category_id, link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        icon,
        title,
        short || '',
        description || '',
        JSON.stringify(features),
        color,
        categoryName,
        categoryId || null,
        link || `/services/${serviceId}`,
      ]
    );

    await insertServicePlans(serviceId, plans);

    const service = await getServiceWithPlans(serviceId);
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      icon,
      title,
      short,
      description,
      features = [],
      color = 'blue',
      categoryId,
      link,
      plans = [],
    } = req.body;

    const serviceId = req.params.id;
    const service = await getServiceWithPlans(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let categoryName = null;
    if (categoryId) {
      const [categoryRows] = await pool.execute('SELECT name FROM categories WHERE id = ? LIMIT 1', [categoryId]);
      if (categoryRows.length === 0) {
        return res.status(400).json({ error: 'Invalid categoryId' });
      }
      categoryName = categoryRows[0].name;
    }

    await pool.execute(
      `UPDATE services
       SET icon = ?, title = ?, short = ?, description = ?, features = ?, color = ?, category = ?, category_id = ?, link = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        icon || service.icon,
        title || service.title,
        short || '',
        description || '',
        JSON.stringify(features),
        color,
        categoryName,
        categoryId || null,
        link || service.link || `/services/${serviceId}`,
        serviceId,
      ]
    );

    await deleteServicePlans(serviceId);
    await insertServicePlans(serviceId, plans);

    const updated = await getServiceWithPlans(serviceId);
    res.json(updated);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const service = await getServiceWithPlans(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    await deleteServicePlans(serviceId);
    await pool.execute('DELETE FROM services WHERE id = ?', [serviceId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;

