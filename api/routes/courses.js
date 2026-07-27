const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { optionalCustomerAuth } = require('../middleware/optionalCustomerAuth');

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Get all published courses
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const params = ['published'];
    let query = `
      SELECT id, title, thumbnail, short_description, instructor_name, level, language, duration,
             price, discount_price, currency, category, category_id, created_at
      FROM courses
      WHERE status = ?
    `;
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY created_at DESC';

    const [courses] = await pool.execute(query, params);
    res.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get a published course by id, with curriculum. video_url is only included
// for preview lessons or when the requester is authenticated and enrolled.
router.get('/:id', optionalCustomerAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ? AND status = ?', [id, 'published']);
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courses[0];

    let isEnrolled = false;
    if (req.customer && req.customer.id) {
      const [enrollments] = await pool.execute(
        'SELECT id FROM course_enrollments WHERE course_id = ? AND customer_id = ? LIMIT 1',
        [id, req.customer.id]
      );
      isEnrolled = enrollments.length > 0;
    }

    const [modules] = await pool.execute(
      'SELECT id, title, sort_order FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
      [id]
    );

    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const [lessons] = await pool.execute(
          'SELECT id, title, duration, is_preview, sort_order, video_url FROM course_lessons WHERE module_id = ? ORDER BY sort_order ASC, id ASC',
          [module.id]
        );
        return {
          ...module,
          lessons: lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            duration: lesson.duration,
            is_preview: !!lesson.is_preview,
            sort_order: lesson.sort_order,
            video_url: lesson.is_preview || isEnrolled ? lesson.video_url : null,
          })),
        };
      })
    );

    res.json({
      ...course,
      features: parseJsonArray(course.features),
      requirements: parseJsonArray(course.requirements),
      modules: modulesWithLessons,
      is_enrolled: isEnrolled,
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

module.exports = router;
