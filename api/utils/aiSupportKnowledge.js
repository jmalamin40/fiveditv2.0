const pool = require('../config/database');
const { defaultLogger } = require('./logger');

const TTL_MS = 90_000;
const MAX_TOTAL_CHARS = 14_000;

let cache = { text: '', expiresAt: 0 };

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function truncateBlock(label, body, budget) {
  if (!body || !body.trim()) return { chunk: '', used: 0 };
  const t = body.trim();
  if (t.length <= budget) return { chunk: `${label}\n${t}\n`, used: t.length + label.length + 2 };
  return {
    chunk: `${label}\n${t.slice(0, Math.max(0, budget - 60))}...\n(truncated)\n`,
    used: budget,
  };
}

/**
 * Builds a text snapshot of public catalog data for the AI support agent.
 * Cached briefly to avoid heavy reads on every chat message.
 */
async function buildWebsiteKnowledgeText() {
  const parts = [];
  let budget = MAX_TOTAL_CHARS;

  const take = (label, text) => {
    const { chunk, used } = truncateBlock(label, text, Math.min(budget, 8000));
    if (chunk) {
      parts.push(chunk);
      budget -= used;
    }
  };

  try {
    const [cats] = await pool.execute(
      'SELECT name, slug, description FROM categories ORDER BY name ASC'
    );
    if (cats.length) {
      const lines = cats.map((c) => {
        const bits = [`- ${c.name} (/${c.slug})`];
        if (c.description) bits.push(String(c.description).replace(/\s+/g, ' ').slice(0, 200));
        return bits.join(': ');
      });
      take('## Service categories', lines.join('\n'));
    }
  } catch (e) {
    defaultLogger.error('AI knowledge: categories', e.message);
  }

  try {
    const [services] = await pool.execute(`
      SELECT s.id, s.title, s.short, s.description, s.link, s.features, c.name AS category_name
      FROM services s
      LEFT JOIN categories c ON c.id = s.category_id
      ORDER BY s.title ASC
    `);
    const [svcPlans] = await pool.execute(
      'SELECT id, service_id, name, price, currency, description, delivery_time, popular FROM service_plans ORDER BY service_id, id'
    );
    const [svcFeats] = await pool.execute(
      "SELECT plan_id, name, included FROM plan_features WHERE plan_type = 'service' ORDER BY plan_id, id"
    );
    const featsByPlan = new Map();
    for (const f of svcFeats) {
      if (!featsByPlan.has(f.plan_id)) featsByPlan.set(f.plan_id, []);
      featsByPlan.get(f.plan_id).push(f.included ? f.name : `${f.name} (optional)`);
    }
    const plansByService = new Map();
    for (const p of svcPlans) {
      if (!plansByService.has(p.service_id)) plansByService.set(p.service_id, []);
      plansByService.get(p.service_id).push(p);
    }

    if (services.length) {
      const lines = [];
      for (const s of services) {
        if (budget < 200) break;
        const row = [];
        row.push(`### ${s.title}`);
        if (s.category_name) row.push(`Category: ${s.category_name}`);
        if (s.short) row.push(String(s.short).replace(/\s+/g, ' ').slice(0, 300));
        if (s.description) row.push(String(s.description).replace(/\s+/g, ' ').slice(0, 400));
        if (s.link) row.push(`Link path/hint: ${s.link}`);
        const featList = parseJsonArray(s.features);
        if (featList.length) row.push(`Highlights: ${featList.slice(0, 8).join('; ')}`);
        const plans = plansByService.get(s.id) || [];
        for (const pl of plans) {
          const price = `${pl.price} ${pl.currency || 'USD'}`;
          const pop = pl.popular ? ' (popular)' : '';
          row.push(`  - Plan "${pl.name}"${pop}: ${price}${pl.delivery_time ? `, delivery: ${pl.delivery_time}` : ''}${pl.description ? ` — ${String(pl.description).slice(0, 120)}` : ''}`);
          const pf = featsByPlan.get(pl.id) || [];
          if (pf.length) row.push(`    Features: ${pf.slice(0, 12).join(', ')}`);
        }
        lines.push(row.join('\n'));
      }
      take('## Main services & plans', lines.join('\n\n'));
    }
  } catch (e) {
    defaultLogger.error('AI knowledge: services', e.message);
  }

  try {
    const [scripts] = await pool.execute(
      'SELECT id, name, category, short_description, description, codecanyon_url FROM codecanyon_scripts ORDER BY name ASC'
    );
    const [scrPlans] = await pool.execute(
      'SELECT id, script_id, name, price, currency, description, delivery_time, popular FROM script_plans ORDER BY script_id, id'
    );
    const [scrFeats] = await pool.execute(
      "SELECT plan_id, name, included FROM plan_features WHERE plan_type = 'script' ORDER BY plan_id, id"
    );
    const scrFeatsByPlan = new Map();
    for (const f of scrFeats) {
      if (!scrFeatsByPlan.has(f.plan_id)) scrFeatsByPlan.set(f.plan_id, []);
      scrFeatsByPlan.get(f.plan_id).push(f.included ? f.name : `${f.name} (optional)`);
    }
    const scrPlansByScript = new Map();
    for (const p of scrPlans) {
      if (!scrPlansByScript.has(p.script_id)) scrPlansByScript.set(p.script_id, []);
      scrPlansByScript.get(p.script_id).push(p);
    }
    if (scripts.length) {
      const lines = [];
      for (const sc of scripts) {
        if (budget < 200) break;
        const row = [`### ${sc.name}`];
        if (sc.category) row.push(`Category: ${sc.category}`);
        if (sc.short_description) row.push(String(sc.short_description).replace(/\s+/g, ' ').slice(0, 280));
        if (sc.description) row.push(String(sc.description).replace(/\s+/g, ' ').slice(0, 350));
        const plans = scrPlansByScript.get(sc.id) || [];
        for (const pl of plans) {
          const price = `${pl.price} ${pl.currency || 'USD'}`;
          const pop = pl.popular ? ' (popular)' : '';
          row.push(`  - Plan "${pl.name}"${pop}: ${price}${pl.delivery_time ? `, delivery: ${pl.delivery_time}` : ''}`);
          const pf = scrFeatsByPlan.get(pl.id) || [];
          if (pf.length) row.push(`    Features: ${pf.slice(0, 12).join(', ')}`);
        }
        lines.push(row.join('\n'));
      }
      take('## CodeCanyon scripts (licensed products) & plans', lines.join('\n\n'));
    }
  } catch (e) {
    defaultLogger.error('AI knowledge: scripts', e.message);
  }

  try {
    const [hosting] = await pool.execute(
      `SELECT display_name, description, price_monthly, price_yearly, currency, disk_space_gb, bandwidth_gb,
              domains, email_accounts, \`databases\`, ssl_included, backups, support_type, popular
       FROM hosting_packages WHERE is_active = TRUE ORDER BY popular DESC, display_name ASC`
    );
    if (hosting.length) {
      const lines = hosting.map((h) => {
        const bits = [
          `- ${h.display_name}: ${h.price_monthly} ${h.currency || 'BDT'}/mo, ${h.price_yearly} ${h.currency || 'BDT'}/yr`,
        ];
        if (h.description) bits.push(String(h.description).replace(/\s+/g, ' ').slice(0, 200));
        bits.push(
          `  Disk ${h.disk_space_gb}GB, bandwidth ${h.bandwidth_gb ?? 'n/a'}GB, domains ${h.domains ?? 'n/a'}, DBs ${h.databases ?? 'n/a'}, SSL ${h.ssl_included ? 'yes' : 'no'}`
        );
        return bits.join('\n');
      });
      take('## Web hosting packages', lines.join('\n'));
    }
  } catch (e) {
    defaultLogger.error('AI knowledge: hosting', e.message);
  }

  try {
    const [smm] = await pool.execute(
      `SELECT display_name, description, price, currency, billing_interval, package_tier, features
       FROM smm_website_products WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC`
    );
    const [smmCfg] = await pool.execute(
      'SELECT website_configuration_price, website_configuration_currency FROM smm_config WHERE id = 1'
    );
    const smmLines = [];
    if (smmCfg.length) {
      const c = smmCfg[0];
      smmLines.push(
        `SMM website configuration (setup) service: ${c.website_configuration_price} ${c.website_configuration_currency || 'BDT'} (see matching product in list if present).`
      );
    }
    for (const p of smm) {
      const feats = parseJsonArray(p.features);
      smmLines.push(
        `- ${p.display_name}${p.package_tier ? ` [${p.package_tier}]` : ''}: ${p.price} ${p.currency || 'BDT'}${p.billing_interval ? ` / ${p.billing_interval}` : ''}${p.description ? ` — ${String(p.description).replace(/\s+/g, ' ').slice(0, 220)}` : ''}${feats.length ? ` | Features: ${feats.slice(0, 10).join(', ')}` : ''}`
      );
    }
    if (smmLines.length) take('## SMM / social media marketing website products', smmLines.join('\n'));
  } catch (e) {
    defaultLogger.error('AI knowledge: smm', e.message);
  }

  const header =
    'Use the sections below for accurate offerings, prices, and plan names. If something is not listed, say you are not sure and offer to connect them with the team.\n';
  const body = parts.join('\n');
  if (!body.trim()) return '';
  return `${header}\n${body}`.slice(0, MAX_TOTAL_CHARS);
}

async function getWebsiteKnowledgeForAi() {
  const now = Date.now();
  if (cache.text && now < cache.expiresAt) return cache.text;
  const text = await buildWebsiteKnowledgeText();
  cache = { text, expiresAt: now + TTL_MS };
  return text;
}

function invalidateWebsiteKnowledgeCache() {
  cache.expiresAt = 0;
  cache.text = '';
}

module.exports = {
  getWebsiteKnowledgeForAi,
  invalidateWebsiteKnowledgeCache,
  buildWebsiteKnowledgeText,
};
