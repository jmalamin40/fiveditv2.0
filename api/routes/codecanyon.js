const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all CodeCanyon scripts
router.get('/', async (req, res) => {
  try {
    const [scripts] = await pool.execute(`
      SELECT * FROM codecanyon_scripts 
      ORDER BY created_at DESC
    `);

    // Get plans for each script
    const scriptsWithPlans = await Promise.all(
      scripts.map(async (script) => {
        const [plans] = await pool.execute(
          `SELECT * FROM script_plans WHERE script_id = ? ORDER BY price ASC`,
          [script.id]
        );

        // Get features for each plan
        const plansWithFeatures = await Promise.all(
          plans.map(async (plan) => {
            const [features] = await pool.execute(
              `SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = 'script' ORDER BY id`,
              [plan.id]
            );
            return { ...plan, features };
          })
        );

        return {
          ...script,
          plans: plansWithFeatures
        };
      })
    );

    res.json({ scripts: scriptsWithPlans });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Get script by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [scripts] = await pool.execute(
      `SELECT * FROM codecanyon_scripts WHERE id = ?`,
      [id]
    );

    if (scripts.length === 0) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const script = scripts[0];

    // Get plans
    const [plans] = await pool.execute(
      `SELECT * FROM script_plans WHERE script_id = ? ORDER BY price ASC`,
      [id]
    );

    // Get features for each plan
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        const [features] = await pool.execute(
          `SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = 'script' ORDER BY id`,
          [plan.id]
        );
        return { ...plan, features };
      })
    );

    const scriptWithPlans = {
      ...script,
      plans: plansWithFeatures
    };

    res.json(scriptWithPlans);
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

// Get scripts by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const [scripts] = await pool.execute(
      `SELECT * FROM codecanyon_scripts WHERE category = ? ORDER BY created_at DESC`,
      [category]
    );

    res.json({ scripts });
  } catch (error) {
    console.error('Error fetching scripts by category:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

module.exports = router;

