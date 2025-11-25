const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all services
router.get('/', async (req, res) => {
  try {
    const [services] = await pool.execute(`
      SELECT * FROM services
      ORDER BY id
    `);

    // Get plans for each service
    const servicesWithPlans = await Promise.all(
      services.map(async (service) => {
        const [plans] = await pool.execute(
          `SELECT * FROM service_plans WHERE service_id = ? ORDER BY price ASC`,
          [service.id]
        );

        // Get features for each plan
        const plansWithFeatures = await Promise.all(
          plans.map(async (plan) => {
            const [features] = await pool.execute(
              `SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = 'service' ORDER BY id`,
              [plan.id]
            );
            return { ...plan, features };
          })
        );

        // Parse features if it's a JSON string, otherwise use as is
        let features = service.features;
        if (typeof features === 'string') {
          try {
            features = JSON.parse(features);
          } catch {
            features = [];
          }
        }
        if (!Array.isArray(features)) {
          features = [];
        }

        return {
          ...service,
          plans: plansWithFeatures,
          features: features
        };
      })
    );

    res.json({ services: servicesWithPlans });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [services] = await pool.execute(
      `SELECT * FROM services WHERE id = ?`,
      [id]
    );

    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = services[0];

    // Get plans
    const [plans] = await pool.execute(
      `SELECT * FROM service_plans WHERE service_id = ? ORDER BY price ASC`,
      [id]
    );

    // Get features for each plan
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        const [features] = await pool.execute(
          `SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = 'service' ORDER BY id`,
          [plan.id]
        );
        return { ...plan, features };
      })
    );

    // Parse features if it's a JSON string, otherwise use as is
    let features = service.features;
    if (typeof features === 'string') {
      try {
        features = JSON.parse(features);
      } catch {
        features = [];
      }
    }
    if (!Array.isArray(features)) {
      features = [];
    }

    const serviceWithPlans = {
      ...service,
      features: features,
      plans: plansWithFeatures
    };

    res.json(serviceWithPlans);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// Get service categories
router.get('/categories/list', async (req, res) => {
  try {
    const [categories] = await pool.execute(
      `SELECT DISTINCT category FROM services ORDER BY category`
    );
    res.json({ categories: categories.map(c => c.category) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;

