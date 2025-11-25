const express = require('express');
const slugify = require('slugify');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, slug, description, created_at, updated_at FROM categories ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slug = slugify(id || name, { lower: true, strict: true });
    const categoryId = id || slug;

    await pool.execute(
      `INSERT INTO categories (id, name, slug, description)
       VALUES (?, ?, ?, ?)`,
      [categoryId, name, slug, description || null]
    );

    res.status(201).json({ id: categoryId, name, slug, description });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const { id } = req.params;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const [result] = await pool.execute(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug, description || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Update services table to keep category name in sync
    await pool.execute(
      `UPDATE services SET category = ? WHERE category_id = ?`,
      [name, id]
    );

    res.json({ id, name, slug, description });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Null-out references before deleting
    await pool.execute(
      `UPDATE services SET category = NULL, category_id = NULL WHERE category_id = ?`,
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;


