const express = require('express');
const slugify = require('slugify');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

async function getScriptWithPlans(scriptId) {
  const [scripts] = await pool.execute(
    'SELECT * FROM codecanyon_scripts WHERE id = ? LIMIT 1',
    [scriptId]
  );

  if (scripts.length === 0) {
    return null;
  }

  const script = scripts[0];
  const [plans] = await pool.execute(
    'SELECT * FROM script_plans WHERE script_id = ? ORDER BY price ASC',
    [scriptId]
  );

  const plansWithFeatures = await Promise.all(
    plans.map(async (plan) => {
      const [features] = await pool.execute(
        'SELECT * FROM plan_features WHERE plan_id = ? AND plan_type = \'script\' ORDER BY id',
        [plan.id]
      );
      return { ...plan, features };
    })
  );

  return {
    ...script,
    plans: plansWithFeatures,
  };
}

async function deleteScriptPlans(scriptId) {
  const [planRows] = await pool.execute(
    'SELECT id FROM script_plans WHERE script_id = ?',
    [scriptId]
  );

  const planIds = planRows.map((plan) => plan.id);
  if (planIds.length > 0) {
    const placeholders = planIds.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM plan_features WHERE plan_id IN (${placeholders}) AND plan_type = 'script'`,
      planIds
    );
  }

  await pool.execute('DELETE FROM script_plans WHERE script_id = ?', [scriptId]);
}

async function insertScriptPlans(scriptId, plans = []) {
  for (const plan of plans) {
    const [planResult] = await pool.execute(
      `INSERT INTO script_plans (script_id, plan_id, name, price, currency, description, delivery_time, popular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scriptId,
        plan.id,
        plan.name,
        plan.price,
        plan.currency || 'USD',
        plan.description || '',
        plan.deliveryTime || '',
        plan.popular || false,
      ]
    );

    const planId = planResult.insertId;
    if (plan.features && Array.isArray(plan.features)) {
      for (const feature of plan.features) {
        await pool.execute(
          `INSERT INTO plan_features (plan_id, plan_type, name, included)
           VALUES (?, 'script', ?, ?)`,
          [planId, feature.name, feature.included !== false]
        );
      }
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const [scripts] = await pool.execute('SELECT id FROM codecanyon_scripts ORDER BY name');
    const results = [];
    for (const script of scripts) {
      const fullScript = await getScriptWithPlans(script.id);
      if (fullScript) {
        results.push(fullScript);
      }
    }
    res.json(results);
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const script = await getScriptWithPlans(req.params.id);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json(script);
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      name,
      category,
      shortDescription,
      description,
      codecanyonUrl,
      imageUrl,
      plans = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const scriptId = id || slugify(name, { lower: true, strict: true });

    const [existing] = await pool.execute('SELECT id FROM codecanyon_scripts WHERE id = ?', [scriptId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Script ID already exists' });
    }

    await pool.execute(
      `INSERT INTO codecanyon_scripts (id, name, category, short_description, description, codecanyon_url, image_url, use_default_plans)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scriptId,
        name,
        category || null,
        shortDescription || '',
        description || '',
        codecanyonUrl || '',
        imageUrl || '',
        false,
      ]
    );

    await insertScriptPlans(scriptId, plans);

    const script = await getScriptWithPlans(scriptId);
    res.status(201).json(script);
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ error: 'Failed to create script' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      category,
      shortDescription,
      description,
      codecanyonUrl,
      imageUrl,
      plans = [],
    } = req.body;

    const scriptId = req.params.id;
    const existing = await getScriptWithPlans(scriptId);
    if (!existing) {
      return res.status(404).json({ error: 'Script not found' });
    }

    await pool.execute(
      `UPDATE codecanyon_scripts
       SET name = ?, category = ?, short_description = ?, description = ?, codecanyon_url = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || existing.name,
        category || existing.category,
        shortDescription || existing.short_description || '',
        description || existing.description || '',
        codecanyonUrl || existing.codecanyon_url || '',
        imageUrl || existing.image_url || '',
        scriptId,
      ]
    );

    await deleteScriptPlans(scriptId);
    await insertScriptPlans(scriptId, plans);

    const script = await getScriptWithPlans(scriptId);
    res.json(script);
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const scriptId = req.params.id;
    const script = await getScriptWithPlans(scriptId);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    await deleteScriptPlans(scriptId);
    await pool.execute('DELETE FROM codecanyon_scripts WHERE id = ?', [scriptId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

module.exports = router;


