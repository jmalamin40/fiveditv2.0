const express = require('express');
const slugify = require('slugify');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

async function getCourseWithCurriculum(courseId) {
  const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ? LIMIT 1', [courseId]);
  if (courses.length === 0) {
    return null;
  }

  const course = courses[0];

  const [modules] = await pool.execute(
    'SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
    [courseId]
  );

  const modulesWithLessons = await Promise.all(
    modules.map(async (module) => {
      const [lessons] = await pool.execute(
        'SELECT * FROM course_lessons WHERE module_id = ? ORDER BY sort_order ASC, id ASC',
        [module.id]
      );
      return { ...module, lessons };
    })
  );

  return {
    ...course,
    features: Array.isArray(course.features) ? course.features : JSON.parse(course.features || '[]'),
    requirements: Array.isArray(course.requirements) ? course.requirements : JSON.parse(course.requirements || '[]'),
    modules: modulesWithLessons,
  };
}

async function deleteCourseCurriculum(courseId) {
  await pool.execute('DELETE FROM course_modules WHERE course_id = ?', [courseId]);
}

async function insertCourseCurriculum(courseId, modules = []) {
  let moduleIndex = 0;
  for (const module of modules) {
    const [moduleResult] = await pool.execute(
      'INSERT INTO course_modules (course_id, title, sort_order) VALUES (?, ?, ?)',
      [courseId, (module.title || '').toString(), moduleIndex]
    );

    const moduleId = moduleResult.insertId;
    const lessons = Array.isArray(module.lessons) ? module.lessons : [];
    let lessonIndex = 0;
    for (const lesson of lessons) {
      const isPreview =
        lesson.isPreview === true ||
        lesson.isPreview === 1 ||
        lesson.isPreview === '1' ||
        lesson.isPreview === 'true';

      await pool.execute(
        `INSERT INTO course_lessons (module_id, title, duration, video_url, is_preview, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          moduleId,
          (lesson.title || '').toString(),
          (lesson.duration || '').toString(),
          (lesson.videoUrl || '').toString(),
          isPreview,
          lessonIndex,
        ]
      );
      lessonIndex += 1;
    }
    moduleIndex += 1;
  }
}

router.get('/', async (req, res) => {
  try {
    const [courses] = await pool.execute('SELECT id FROM courses ORDER BY title');
    const results = [];
    for (const course of courses) {
      const fullCourse = await getCourseWithCurriculum(course.id);
      if (fullCourse) {
        results.push(fullCourse);
      }
    }
    res.json(results);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let query = `
      SELECT co.*, c.title AS course_current_title
      FROM course_orders co
      LEFT JOIN courses c ON c.id = co.course_id
    `;
    if (status) {
      query += ' WHERE co.status = ?';
      params.push(status);
    }
    query += ' ORDER BY co.created_at DESC';

    const [orders] = await pool.execute(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching course orders:', error);
    res.status(500).json({ error: 'Failed to fetch course orders' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await getCourseWithCurriculum(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      id,
      title,
      thumbnail,
      shortDescription,
      description,
      instructorName,
      level = 'beginner',
      language = 'English',
      duration,
      price,
      discountPrice,
      currency = 'BDT',
      categoryId,
      features = [],
      requirements = [],
      status = 'draft',
      modules = [],
    } = req.body;

    if (!title || price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Title and price are required' });
    }

    const courseId = id || slugify(title, { lower: true, strict: true });

    const [existing] = await pool.execute('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Course ID already exists' });
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
      `INSERT INTO courses (
        id, title, thumbnail, short_description, description, instructor_name, level, language,
        duration, price, discount_price, currency, category, category_id, features, requirements, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        title,
        thumbnail || null,
        shortDescription || '',
        description || '',
        instructorName || '',
        level,
        language,
        duration || '',
        Number(price),
        discountPrice !== undefined && discountPrice !== null && discountPrice !== '' ? Number(discountPrice) : null,
        currency,
        categoryName,
        categoryId || null,
        JSON.stringify(features),
        JSON.stringify(requirements),
        status,
      ]
    );

    await insertCourseCurriculum(courseId, modules);

    const course = await getCourseWithCurriculum(courseId);
    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      thumbnail,
      shortDescription,
      description,
      instructorName,
      level = 'beginner',
      language = 'English',
      duration,
      price,
      discountPrice,
      currency = 'BDT',
      categoryId,
      features = [],
      requirements = [],
      status = 'draft',
      modules = [],
    } = req.body;

    const courseId = req.params.id;
    const course = await getCourseWithCurriculum(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
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
      `UPDATE courses
       SET title = ?, thumbnail = ?, short_description = ?, description = ?, instructor_name = ?,
           level = ?, language = ?, duration = ?, price = ?, discount_price = ?, currency = ?,
           category = ?, category_id = ?, features = ?, requirements = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title || course.title,
        thumbnail !== undefined ? thumbnail || null : course.thumbnail,
        shortDescription !== undefined ? shortDescription : course.short_description,
        description !== undefined ? description : course.description,
        instructorName !== undefined ? instructorName : course.instructor_name,
        level,
        language,
        duration !== undefined ? duration : course.duration,
        price !== undefined && price !== null && price !== '' ? Number(price) : course.price,
        discountPrice !== undefined && discountPrice !== null && discountPrice !== '' ? Number(discountPrice) : null,
        currency,
        categoryName,
        categoryId || null,
        JSON.stringify(features),
        JSON.stringify(requirements),
        status,
        courseId,
      ]
    );

    await deleteCourseCurriculum(courseId);
    await insertCourseCurriculum(courseId, modules);

    const updated = await getCourseWithCurriculum(courseId);
    res.json(updated);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await getCourseWithCurriculum(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await deleteCourseCurriculum(courseId);
    await pool.execute('DELETE FROM courses WHERE id = ?', [courseId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;
