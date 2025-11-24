const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all reviews with optional filters
router.get('/', async (req, res) => {
  try {
    const { rating, repeatClient, search, page = 1, limit = 10 } = req.query;
    
    let query = 'SELECT * FROM reviews WHERE 1=1';
    const params = [];

    if (rating) {
      query += ' AND rating = ?';
      params.push(rating);
    }

    if (repeatClient !== undefined) {
      query += ' AND is_repeat_client = ?';
      params.push(repeatClient === 'true' ? 1 : 0);
    }

    if (search) {
      query += ' AND (review_text LIKE ? OR reviewer_name LIKE ? OR location LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count before adding ORDER BY and LIMIT
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Add ordering and pagination
    query += ' ORDER BY created_at DESC';
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [reviews] = await pool.execute(query, params);

    // Calculate stats
    const [statsResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN is_repeat_client = 1 THEN 1 ELSE 0 END) as repeat_clients,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star_reviews
      FROM reviews
    `);

    const statsData = statsResult[0];
    const stats = {
      totalReviews: statsData.total_reviews || 0,
      averageRating: parseFloat(statsData.average_rating || 0).toFixed(1),
      repeatClients: statsData.repeat_clients || 0,
      fiveStarReviews: statsData.five_star_reviews || 0,
      satisfactionRate: statsData.total_reviews > 0 
        ? ((statsData.five_star_reviews / statsData.total_reviews) * 100).toFixed(0)
        : '0'
    };

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        reviewerName: r.reviewer_name || '',
        reviewerInitial: r.reviewer_initial || '',
        location: r.location || '',
        countryCode: r.country_code || '',
        isRepeatClient: r.is_repeat_client === 1,
        rating: r.rating || 0,
        timePosted: r.time_posted || '',
        reviewText: r.review_text || '',
        priceRange: r.price_range || '',
        duration: r.duration || '',
        helpfulCount: r.helpful_count || 0
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get review by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [reviews] = await pool.execute(
      'SELECT * FROM reviews WHERE id = ?',
      [id]
    );

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = reviews[0];
    res.json({
      id: review.id,
      reviewerName: review.reviewer_name || '',
      reviewerInitial: review.reviewer_initial || '',
      location: review.location || '',
      countryCode: review.country_code || '',
      isRepeatClient: review.is_repeat_client === 1,
      rating: review.rating || 0,
      timePosted: review.time_posted || '',
      reviewText: review.review_text || '',
      priceRange: review.price_range || '',
      duration: review.duration || '',
      helpfulCount: review.helpful_count || 0
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Update helpful count
router.post('/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?',
      [id]
    );

    const [reviews] = await pool.execute(
      'SELECT helpful_count FROM reviews WHERE id = ?',
      [id]
    );

    res.json({ helpfulCount: reviews[0].helpful_count });
  } catch (error) {
    console.error('Error updating helpful count:', error);
    res.status(500).json({ error: 'Failed to update helpful count' });
  }
});

module.exports = router;

