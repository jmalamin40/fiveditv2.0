/**
 * Traffic analytics: public track endpoint + admin stats.
 * POST /api/analytics/track - page view + visitor/session + duration + optional ?ref= (email links).
 * GET /api/admin/analytics/traffic - aggregated stats.
 * GET /api/admin/analytics/email-ref-export - CSV of sessions where ?ref= is an email.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { defaultLogger } = require('../utils/logger');

let geoipLite = null;
try {
  geoipLite = require('geoip-lite');
} catch (_) {
  defaultLogger.warn('geoip-lite not installed; country will use CF header only');
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf && String(xf).trim()) {
    const first = String(xf).split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && String(realIp).trim()) return String(realIp).trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return '';
}

function normalizeIp(ip) {
  if (!ip) return null;
  let s = String(ip).trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  if (s === '::1' || s.startsWith('127.') || s.startsWith('10.') || /^192\.168\./.test(s) || /^172\.(1[6-9]|2\d|3[01])\./.test(s)) {
    return null;
  }
  return s || null;
}

function resolveCountry(req) {
  const cf = req.headers['cf-ipcountry'];
  if (cf && String(cf).trim() && String(cf).toUpperCase() !== 'XX' && String(cf).toUpperCase() !== 'T1') {
    const code = String(cf).trim().toUpperCase().slice(0, 2);
    return { country_code: code, country_name: countryLabel(code) };
  }
  const ip = normalizeIp(getClientIp(req));
  if (!ip || !geoipLite) {
    return { country_code: null, country_name: null };
  }
  const geo = geoipLite.lookup(ip);
  if (!geo || !geo.country || geo.country === 'XX') {
    return { country_code: null, country_name: null };
  }
  const code = geo.country.toUpperCase();
  return { country_code: code, country_name: countryLabel(code) };
}

function countryLabel(code) {
  if (!code || code.length !== 2) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch (_) {
    return code;
  }
}

/** Decode and trim ?ref= value; normalize email-shaped refs to lowercase. */
function normalizeRefParam(raw) {
  if (raw == null || raw === '') return { value: null, isEmail: false };
  let s = String(raw).trim();
  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch (_) {
    /* keep s */
  }
  s = s.trim().substring(0, 320);
  if (!s) return { value: null, isEmail: false };
  const isEmail = looksLikeEmail(s);
  if (isEmail) s = s.toLowerCase();
  return { value: s, isEmail };
}

function looksLikeEmail(s) {
  const t = String(s).trim();
  if (t.length < 5 || t.length > 254) return false;
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t);
}

function deriveSource(referrer, utmSource, utmMedium, refParamNormalized, refIsEmail) {
  if (refIsEmail && refParamNormalized) return 'email';
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

const MAX_DURATION = 86400 * 2;

function clampDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), MAX_DURATION);
}

async function upsertTrafficVisit({
  visitor_id,
  session_id,
  path,
  country_code,
  country_name,
  duration_seconds,
  incrementPageview,
  ref_param,
  ref_is_email,
}) {
  const vid = visitor_id && String(visitor_id).trim().substring(0, 64);
  const sid = session_id && String(session_id).trim().substring(0, 64);
  if (!vid || !sid) return;

  const dur = clampDuration(duration_seconds);
  const pathSafe = path ? String(path).trim().substring(0, 500) : null;
  const inc = incrementPageview && pathSafe ? 1 : 0;
  const refP = ref_param ? String(ref_param).substring(0, 320) : null;
  const refE = ref_is_email ? 1 : 0;

  const [existing] = await pool.execute(
    'SELECT id, last_path FROM traffic_visits WHERE session_id = ? LIMIT 1',
    [sid]
  );

  if (existing.length === 0) {
    const land = pathSafe || '/';
    const initialPages = inc > 0 ? 1 : 0;
    await pool.execute(
      `INSERT INTO traffic_visits (
        visitor_id, session_id, country_code, country_name, landing_path, last_path, page_views, duration_seconds,
        ref_param, ref_is_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vid, sid, country_code, country_name, land, pathSafe || land, initialPages, dur, refP, refE]
    );
    return;
  }

  const lastPath = pathSafe || existing[0].last_path || '/';
  await pool.execute(
    `UPDATE traffic_visits SET
      last_path = ?,
      page_views = page_views + ?,
      duration_seconds = GREATEST(duration_seconds, ?),
      last_activity_at = CURRENT_TIMESTAMP,
      country_code = COALESCE(country_code, ?),
      country_name = COALESCE(country_name, ?),
      ref_param = COALESCE(ref_param, ?),
      ref_is_email = GREATEST(ref_is_email, ?)
    WHERE session_id = ?`,
    [lastPath, inc, dur, country_code, country_name, refP, refE, sid]
  );
}

// ----- Public: track page view (no auth) -----
router.post('/track', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      path: rawPath,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      visitor_id,
      session_id,
      duration_seconds,
      ref_param: rawRef,
    } = body;

    const { country_code, country_name } = resolveCountry(req);
    const { value: refNormalized, isEmail: refIsEmail } = normalizeRefParam(rawRef);

    const vid = visitor_id ? String(visitor_id).trim().substring(0, 64) : null;
    const sid = session_id ? String(session_id).trim().substring(0, 64) : null;
    const hasPath = rawPath != null && String(rawPath).trim() !== '';

    if (vid && sid) {
      await upsertTrafficVisit({
        visitor_id: vid,
        session_id: sid,
        path: hasPath ? String(rawPath).trim() : null,
        country_code,
        country_name,
        duration_seconds,
        incrementPageview: hasPath,
        ref_param: refNormalized,
        ref_is_email: refIsEmail,
      });
    }

    if (hasPath) {
      const path = String(rawPath).trim().substring(0, 500) || '/';
      const ref = referrer ? String(referrer).trim().substring(0, 1000) : null;
      const referrerDomain = ref ? extractReferrerDomain(ref) : null;
      const utmSource = (utm_source && String(utm_source).trim().substring(0, 255)) || null;
      const utmMedium = (utm_medium && String(utm_medium).trim().substring(0, 255)) || null;
      const utmCampaign = (utm_campaign && String(utm_campaign).trim().substring(0, 255)) || null;
      const source = deriveSource(ref, utmSource, utmMedium, refNormalized, refIsEmail);

      await pool.execute(
        `INSERT INTO traffic_events (
          path, referrer, referrer_domain, source, utm_source, utm_medium, utm_campaign,
          visitor_id, session_id, country_code, ref_param, ref_is_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          path,
          ref,
          referrerDomain,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          vid,
          sid,
          country_code,
          refNormalized,
          refIsEmail ? 1 : 0,
        ]
      );
    }

    res.status(204).end();
  } catch (e) {
    defaultLogger.error('Analytics track error:', e);
    res.status(500).end();
  }
});

// ----- Admin: get traffic stats -----
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

function maskVisitorId(id) {
  if (!id || id.length < 4) return '—';
  return `···${id.slice(-8)}`;
}

function csvEscape(cell) {
  const s = cell == null ? '' : String(cell);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

adminRouter.get('/email-ref-export', async (req, res) => {
  try {
    const from = (req.query.from && String(req.query.from).trim()) || null;
    const to = (req.query.to && String(req.query.to).trim()) || null;
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const fromDate = from || defaultFrom.toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.execute(
      `SELECT ref_param, visitor_id, session_id, duration_seconds, page_views, landing_path, last_path,
              country_code, country_name, started_at, last_activity_at
       FROM traffic_visits
       WHERE ref_is_email = 1 AND DATE(started_at) BETWEEN ? AND ?
       ORDER BY started_at DESC`,
      [fromDate, toDate]
    );

    const header = [
      'ref_email',
      'visitor_id',
      'session_id',
      'duration_seconds',
      'duration_human',
      'page_views',
      'landing_path',
      'last_path',
      'country_code',
      'country_name',
      'started_at',
      'last_activity_at',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const ds = Number(r.duration_seconds || 0);
      const human = `${Math.floor(ds / 3600)}h ${Math.floor((ds % 3600) / 60)}m ${ds % 60}s`;
      lines.push(
        [
          csvEscape(r.ref_param),
          csvEscape(r.visitor_id),
          csvEscape(r.session_id),
          ds,
          csvEscape(human),
          Number(r.page_views || 0),
          csvEscape(r.landing_path),
          csvEscape(r.last_path),
          csvEscape(r.country_code),
          csvEscape(r.country_name),
          csvEscape(r.started_at),
          csvEscape(r.last_activity_at),
        ].join(',')
      );
    }

    const csv = lines.join('\r\n');
    const fname = `email-ref-traffic_${fromDate}_to_${toDate}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send('\uFEFF' + csv);
  } catch (e) {
    defaultLogger.error('Admin email-ref export error:', e);
    res.status(500).json({ error: 'Failed to export' });
  }
});

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

    const [visitAgg] = await pool.execute(
      `SELECT 
         COUNT(*) AS sessions,
         COALESCE(AVG(duration_seconds), 0) AS avg_duration,
         COALESCE(SUM(page_views), 0) AS total_page_views
       FROM traffic_visits
       WHERE DATE(started_at) BETWEEN ? AND ?`,
      [fromDate, toDate]
    );
    const sessionStats = {
      sessions: Number(visitAgg[0]?.sessions || 0),
      avgSessionSeconds: Math.round(Number(visitAgg[0]?.avg_duration || 0)),
      totalPageViews: Number(visitAgg[0]?.total_page_views || 0),
    };

    const [emailRefAgg] = await pool.execute(
      `SELECT 
         COUNT(*) AS sessions,
         COALESCE(AVG(duration_seconds), 0) AS avg_duration,
         COALESCE(SUM(duration_seconds), 0) AS total_duration
       FROM traffic_visits
       WHERE ref_is_email = 1 AND DATE(started_at) BETWEEN ? AND ?`,
      [fromDate, toDate]
    );
    const emailRefSummary = {
      sessions: Number(emailRefAgg[0]?.sessions || 0),
      avgSessionSeconds: Math.round(Number(emailRefAgg[0]?.avg_duration || 0)),
      totalDurationSeconds: Math.round(Number(emailRefAgg[0]?.total_duration || 0)),
    };

    const [emailRefByRecipientRows] = await pool.execute(
      `SELECT ref_param AS ref_email,
              COUNT(*) AS sessions,
              SUM(duration_seconds) AS total_duration_seconds,
              AVG(duration_seconds) AS avg_duration_seconds
       FROM traffic_visits
       WHERE ref_is_email = 1 AND DATE(started_at) BETWEEN ? AND ? AND ref_param IS NOT NULL AND ref_param != ''
       GROUP BY ref_param
       ORDER BY sessions DESC, total_duration_seconds DESC
       LIMIT 50`,
      [fromDate, toDate]
    );
    const emailRefByRecipient = emailRefByRecipientRows.map((r) => ({
      refEmail: r.ref_email,
      sessions: Number(r.sessions || 0),
      totalDurationSeconds: Math.round(Number(r.total_duration_seconds || 0)),
      avgDurationSeconds: Math.round(Number(r.avg_duration_seconds || 0)),
    }));

    const [emailRefSessionsRows] = await pool.execute(
      `SELECT ref_param, visitor_id, duration_seconds, page_views, landing_path, last_path,
              country_code, country_name, started_at, last_activity_at
       FROM traffic_visits
       WHERE ref_is_email = 1 AND DATE(started_at) BETWEEN ? AND ?
       ORDER BY started_at DESC
       LIMIT 200`,
      [fromDate, toDate]
    );
    const emailRefSessions = emailRefSessionsRows.map((r) => ({
      refEmail: r.ref_param,
      visitorLabel: maskVisitorId(r.visitor_id),
      durationSeconds: Number(r.duration_seconds || 0),
      pageViews: Number(r.page_views || 0),
      landingPath: r.landing_path || '/',
      lastPath: r.last_path || '/',
      countryCode: r.country_code,
      countryName: r.country_name || (r.country_code ? countryLabel(r.country_code) : null) || '—',
      startedAt: r.started_at,
      lastActivityAt: r.last_activity_at,
    }));

    const [byCountryRows] = await pool.execute(
      `SELECT country_code, country_name, COUNT(*) AS visits
       FROM traffic_visits
       WHERE DATE(started_at) BETWEEN ? AND ? AND country_code IS NOT NULL AND country_code != ''
       GROUP BY country_code, country_name
       ORDER BY visits DESC
       LIMIT 25`,
      [fromDate, toDate]
    );
    const byCountry = byCountryRows.map((r) => ({
      countryCode: r.country_code,
      countryName: r.country_name || countryLabel(r.country_code) || r.country_code,
      visits: Number(r.visits),
    }));

    const [recentSessionsRows] = await pool.execute(
      `SELECT visitor_id, session_id, duration_seconds, page_views, country_code, country_name,
              landing_path, last_path, started_at, last_activity_at
       FROM traffic_visits
       WHERE DATE(started_at) BETWEEN ? AND ?
       ORDER BY started_at DESC
       LIMIT 150`,
      [fromDate, toDate]
    );
    const recentSessions = recentSessionsRows.map((r) => ({
      visitorLabel: maskVisitorId(r.visitor_id),
      durationSeconds: Number(r.duration_seconds || 0),
      pageViews: Number(r.page_views || 0),
      countryCode: r.country_code,
      countryName: r.country_name || (r.country_code ? countryLabel(r.country_code) : null) || '—',
      landingPath: r.landing_path || '/',
      lastPath: r.last_path || '/',
      startedAt: r.started_at,
      lastActivityAt: r.last_activity_at,
    }));

    const [byVisitorRows] = await pool.execute(
      `SELECT visitor_id,
              COUNT(*) AS session_count,
              SUM(duration_seconds) AS total_duration_seconds,
              MAX(duration_seconds) AS longest_session_seconds
       FROM traffic_visits
       WHERE DATE(started_at) BETWEEN ? AND ?
       GROUP BY visitor_id
       ORDER BY session_count DESC, total_duration_seconds DESC
       LIMIT 50`,
      [fromDate, toDate]
    );
    const byVisitor = byVisitorRows.map((r) => ({
      visitorLabel: maskVisitorId(r.visitor_id),
      sessionCount: Number(r.session_count || 0),
      totalDurationSeconds: Number(r.total_duration_seconds || 0),
      longestSessionSeconds: Number(r.longest_session_seconds || 0),
    }));

    res.json({
      from: fromDate,
      to: toDate,
      totalVisits,
      bySource,
      topReferrers,
      topPaths,
      visitsByDay,
      sessionStats,
      emailRefSummary,
      emailRefByRecipient,
      emailRefSessions,
      byCountry,
      recentSessions,
      byVisitor,
    });
  } catch (e) {
    defaultLogger.error('Admin analytics traffic error:', e);
    res.status(500).json({ error: 'Failed to load traffic data' });
  }
});

router.adminRouter = adminRouter;
module.exports = router;
