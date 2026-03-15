/**
 * Traffic analytics: public track endpoint + admin stats.
 * POST /api/analytics/track - record page view (path, referrer, UTM).
 * GET /api/admin/analytics/traffic - aggregated stats (by source, top referrers, top paths, by day).
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

function deriveSource(referrer, utmSource, utmMedium) {
  if (utmSource) {
    const s = (utmSource || '').toLowerCase();
    if (['google', 'bing', 'yahoo', 'duckduckgo', 'baidu'].some((e) => s.includes(e))) return 'search';
    if (['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'pinterest', 'reddit'].some((e) => s.includes(e))) return 'social';
    if (s.includes('email') || (utmMedium || '').toLowerCase().includes('email')) return 'email';
    return 'referral';
  }
  if (!referrer || !referrer.trim()) return 'direct';
  try {
    const domain = new URL(referrer).hostname.toLowerCase();
    if (['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'baidu.'].some((p) => domain.includes(p))) return 'search';
    if (['facebook.', 'twitter.', 'linkedin.', 'instagram.', 'youtube.', 'tiktok.', 'pinterest.', 'reddit.'].some((p) => domain.includes(p))) return 'social';
    return 'referral';
  } catch (_) {
    return 'referral';
  }
}

function extractReferrerDomain(referrer) {
  if (!referrer || !referrer.trim()) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch (_) {
    return referrer.substring(0, 255);
  }
}

// ----- Public: track page view (no auth) -----
router.post('/track', async (req, res) => {
  try {
    const { path: rawPath, referrer, utm_source, utm_medium, utm_campaign } = req.body || {};
    const path = (rawPath && String(rawPath).trim()) || '/';
    const pathSafe = path.substring(0, 500);
    const ref = referrer ? String(referrer).trim().substring(0, 1000) : null;
    const referrerDomain = ref ? extractReferrerDomain(ref) : null;
    const source = deriveSource(ref, utm_source, utm_medium);
    const utmSource = (utm_source && String(utm_source).trim().substring(0, 255)) || null;
    const utmMedium = (utm_medium && String(utm_medium).trim().substring(0, 255)) || null;
    const utmCampaign = (utm_campaign && String(utm_campaign).trim().substring(0, 255)) || null;

    await pool.execute(
      `INSERT INTO traffic_events (path, referrer, referrer_domain, source, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pathSafe, ref, referrerDomain, source, utmSource, utmMedium, utmCampaign]
    );
    res.status(204).end();
  } catch (e) {
    defaultLogger.error('Analytics track error:', e);
    res.status(500).end();
  }
});

// ----- Admin: get traffic stats -----
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/traffic', async (req, res) => {
  try {
    const from = (req.query.from && String(req.query.from).trim()) || null;
    const to = (req.query.to && String(req.query.to).trim()) || null;
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const fromDate = from || defaultFrom.toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM traffic_events WHERE DATE(created_at) BETWEEN ? AND ?`,
      [fromDate, toDate]
    );
    const totalVisits = Number(totalRows[0]?.total || 0);

    const [bySourceRows] = await pool.execute(
      `SELECT source, COUNT(*) AS count FROM traffic_events WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY source`,
      [fromDate, toDate]
    );
    const bySource = { direct: 0, referral: 0, search: 0, social: 0, email: 0 };
    bySourceRows.forEach((r) => {
      bySource[r.source] = Number(r.count);
    });

    const [topReferrersRows] = await pool.execute(
      `SELECT referrer_domain AS domain, COUNT(*) AS count FROM traffic_events
       WHERE DATE(created_at) BETWEEN ? AND ? AND referrer_domain IS NOT NULL AND referrer_domain != ''
       GROUP BY referrer_domain ORDER BY count DESC LIMIT 15`,
      [fromDate, toDate]
    );
    const topReferrers = topReferrersRows.map((r) => ({ domain: r.domain || '(unknown)', count: Number(r.count) }));

    const [topPathsRows] = await pool.execute(
      `SELECT path, COUNT(*) AS count FROM traffic_events WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY path ORDER BY count DESC LIMIT 15`,
      [fromDate, toDate]
    );
    const topPaths = topPathsRows.map((r) => ({ path: r.path || '/', count: Number(r.count) }));

    const [byDayRows] = await pool.execute(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM traffic_events
       WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY date ASC`,
      [fromDate, toDate]
    );
    const visitsByDay = byDayRows.map((r) => ({ date: r.date, count: Number(r.count) }));

    res.json({
      from: fromDate,
      to: toDate,
      totalVisits,
      bySource,
      topReferrers,
      topPaths,
      visitsByDay,
    });
  } catch (e) {
    defaultLogger.error('Admin analytics traffic error:', e);
    res.status(500).json({ error: 'Failed to load traffic data' });
  }
});

router.adminRouter = adminRouter;
module.exports = router;
