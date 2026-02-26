const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { defaultLogger } = require('./logger');

const SUPABASE_API = 'https://api.supabase.com/v1';

/**
 * Get Supabase Management API config from env.
 * Required: SUPABASE_ACCESS_TOKEN (Bearer), SUPABASE_ORG_SLUG
 * Optional: SUPABASE_REGION (default ap-southeast-1)
 */
function getSupabaseConfig() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const orgSlug = process.env.SUPABASE_ORG_SLUG;
  if (!token || !orgSlug) return null;
  return {
    token,
    orgSlug,
    region: process.env.SUPABASE_REGION || 'ap-southeast-1',
  };
}

function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Step 01: Create a Supabase project.
 * Returns { id, ref, name, region, status }.
 */
async function createSupabaseProject(name, dbPass, orgSlug, region) {
  const url = `${SUPABASE_API}/projects`;
  const body = {
    name,
    db_pass: dbPass,
    organization_slug: orgSlug,
    region: region || 'ap-southeast-1',
  };
  defaultLogger.log(`SMM Supabase: creating project ${name} in ${region}`);
  const { data } = await axios.post(url, body, {
    headers: getAuthHeaders(process.env.SUPABASE_ACCESS_TOKEN),
    timeout: 60000,
  });
  defaultLogger.log(`SMM Supabase: project created ref=${data.ref}`);
  return data;
}

/**
 * Step 02: Fetch API keys for the project. Use ?reveal=true to get key values.
 * Returns { anonKey, serviceRoleKey } for use in client and admin auth.
 */
async function getSupabaseApiKeys(projectRef, token) {
  const url = `${SUPABASE_API}/projects/${projectRef}/api-keys?reveal=true`;
  defaultLogger.log(`SMM Supabase: fetching api-keys for ${projectRef}`);
  const { data } = await axios.get(url, {
    headers: getAuthHeaders(token),
    timeout: 15000,
  });
  if (!Array.isArray(data)) return { anonKey: null, serviceRoleKey: null };
  const anon = data.find((k) => k.name === 'anon');
  const serviceRole = data.find((k) => k.name === 'service_role');
  return {
    anonKey: anon ? anon.api_key : (data[0] && data[0].api_key) || null,
    serviceRoleKey: serviceRole ? serviceRole.api_key : null,
  };
}

/**
 * Step 03: Run SQL query (e.g. import schema) on the project.
 */
async function runSupabaseQuery(projectRef, query, token) {
  const url = `${SUPABASE_API}/projects/${projectRef}/database/query`;
  defaultLogger.log(`SMM Supabase: running query on ${projectRef} (${query.length} chars)`);
  await axios.post(
    url,
    { query },
    {
      headers: getAuthHeaders(token),
      timeout: 120000,
    }
  );
  defaultLogger.log('SMM Supabase: query completed');
}

/**
 * Full setup: create project, wait for it to be ready (poll status), get api keys, run schema.
 * Returns { url, anonKey, serviceRoleKey, projectResponse } or null on failure.
 * projectResponse is the raw API response from create project (id, ref, name, region, etc.).
 * Project name must be unique (e.g. smm-order-37 or domain-com).
 */
async function setupSupabaseForInstance(projectName, dbPass) {
  const config = getSupabaseConfig();
  if (!config) {
    defaultLogger.warn('SMM Supabase: SUPABASE_ACCESS_TOKEN or SUPABASE_ORG_SLUG not set');
    return null;
  }
  const token = config.token;
  const orgSlug = config.orgSlug;
  const region = config.region;

  try {
    const project = await createSupabaseProject(projectName, dbPass, orgSlug, region);
    const ref = project.ref;
    if (!ref) {
      defaultLogger.error('SMM Supabase: create project did not return ref');
      return null;
    }
    const projectResponse = { ...project };

    // Project may be INACTIVE initially; wait a bit then fetch keys (keys may appear after DB is ready)
    await new Promise((r) => setTimeout(r, 15000));
    let keys = await getSupabaseApiKeys(ref, token);
    let retries = 6;
    while (!keys.anonKey && retries > 0) {
      await new Promise((r) => setTimeout(r, 10000));
      keys = await getSupabaseApiKeys(ref, token);
      retries--;
    }
    if (!keys.anonKey) {
      defaultLogger.warn('SMM Supabase: anon key not found yet, url will work when project is ready');
    }

    const schemaPath = process.env.SMM_SUPABASE_SCHEMA_PATH || path.join(__dirname, '..', 'supabasedb', 'db.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      try {
        await runSupabaseQuery(ref, schemaSql, token);
      } catch (err) {
        defaultLogger.error('SMM Supabase: schema import failed', err.response?.data || err.message);
      }
    } else {
      defaultLogger.warn('SMM Supabase: schema file not found at ' + schemaPath);
    }

    const url = `https://${ref}.supabase.co`;
    return {
      url,
      anonKey: keys.anonKey || '',
      serviceRoleKey: keys.serviceRoleKey || '',
      projectResponse,
    };
  } catch (err) {
    defaultLogger.error('SMM Supabase setup error:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Create an authentication user in a Supabase project (admin API).
 * Uses the project's service_role key. Call this after the project is ready.
 *
 * @param {string} supabaseUrl - Project URL, e.g. https://<ref>.supabase.co
 * @param {string} serviceRoleKey - Service role key (from getSupabaseApiKeys)
 * @param {object} options - User options
 * @param {string} options.email - User email
 * @param {string} options.password - User password
 * @param {boolean} [options.email_confirm=true] - Mark email as confirmed
 * @param {object} [options.user_metadata] - Optional user_metadata
 * @returns {Promise<{ id: string, email: string }|null>} Created user or null on failure
 */
async function createSupabaseAuthUser(supabaseUrl, serviceRoleKey, options) {
  if (!supabaseUrl || !serviceRoleKey) {
    defaultLogger.warn('SMM Supabase: createSupabaseAuthUser requires supabaseUrl and serviceRoleKey');
    return null;
  }
  const { email, password, email_confirm = true, user_metadata } = options || {};
  if (!email || !password) {
    defaultLogger.warn('SMM Supabase: createSupabaseAuthUser requires email and password');
    return null;
  }
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/auth/v1/admin/users`;
  const body = { email, password, email_confirm: !!email_confirm };
  if (user_metadata && typeof user_metadata === 'object') body.user_metadata = user_metadata;
  try {
    defaultLogger.log(`SMM Supabase: creating auth user ${email}`);
    const { data } = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    defaultLogger.log('SMM Supabase: auth user created', data?.id);
    return data ? { id: data.id, email: data.email } : null;
  } catch (err) {
    defaultLogger.error('SMM Supabase: create auth user failed', err.response?.data || err.message);
    return null;
  }
}

/**
 * Replace Supabase URL and anon key in the provisioned codebase (domain folder).
 * - Replaces any https://*.supabase.co with the new url
 * - Replaces placeholder URL (e.g. https://xxxxxxxxxxxx.com or with path like /rest/v1/...) with the new url
 * - Replaces placeholder anon key everywhere: literal string, apikey value, "Bearer yyy..." in authorization
 * - Replaces process.env.VITE_SUPABASE_URL / process.env.VITE_SUPABASE_ANON_KEY with the new values
 * - Updates or creates .env / .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *
 * Placeholders can be overridden via env: SMM_SUPABASE_URL_PLACEHOLDER, SMM_SUPABASE_ANON_KEY_PLACEHOLDER
 */
function replaceSupabaseConfigInCodebase(folderPath, url, anonKey) {
  defaultLogger.log('SMM Supabase replace: replacing URL and anon key in', folderPath);
  if (!url) return;
  const fullPath = path.isAbsolute(folderPath) ? folderPath : path.resolve(folderPath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    defaultLogger.warn('SMM Supabase replace: folder not found or not a directory', fullPath);
    return;
  }
  const urlPattern = /https:\/\/[a-z0-9-]+\.supabase\.co/g;
  const urlPlaceholder = process.env.SMM_SUPABASE_URL_PLACEHOLDER || 'https://xxxxxxxxxxxx.com';
  const anonKeyPlaceholder = process.env.SMM_SUPABASE_ANON_KEY_PLACEHOLDER || 'yyyyyyyyyyyyyyyyyyy';
  const urlPlaceholderRegex = /https:\/\/x+\.com/g;
  const bearerPlaceholderRegex = /Bearer\s+y{10,}/g;
  const extensions = ['.html', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.env', '.env.local', '.env.production', '.json'];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.git') walk(full);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (!extensions.includes(ext)) continue;
      try {
        let content = fs.readFileSync(full, 'utf8');
        let changed = false;
        if (urlPattern.test(content)) {
          content = content.replace(urlPattern, url);
          changed = true;
        }
        if (content.includes(urlPlaceholder)) {
          content = content.split(urlPlaceholder).join(url);
          changed = true;
        }
        if (urlPlaceholderRegex.test(content)) {
          content = content.replace(urlPlaceholderRegex, url);
          changed = true;
        }
        if (anonKey) {
          if (content.includes(anonKeyPlaceholder)) {
            content = content.split(anonKeyPlaceholder).join(anonKey);
            changed = true;
          }
          if (bearerPlaceholderRegex.test(content)) {
            content = content.replace(bearerPlaceholderRegex, 'Bearer ' + anonKey);
            changed = true;
          }
        }
        if (content.includes('process.env.VITE_SUPABASE_URL')) {
          content = content.replace(/process\.env\.VITE_SUPABASE_URL/g, JSON.stringify(url));
          changed = true;
        }
        if (anonKey && content.includes('process.env.VITE_SUPABASE_ANON_KEY')) {
          content = content.replace(/process\.env\.VITE_SUPABASE_ANON_KEY/g, JSON.stringify(anonKey));
          changed = true;
        }
        if (changed) fs.writeFileSync(full, content, 'utf8');
      } catch (err) {
        defaultLogger.warn('SMM Supabase replace: skip file', full, err.message);
      }
    }
  };
  walk(fullPath);
  const envLines = [`VITE_SUPABASE_URL=${url}`, `VITE_SUPABASE_ANON_KEY=${anonKey || ''}`];
  for (const name of ['.env', '.env.local', '.env.production']) {
    const envPath = path.join(fullPath, name);
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    let updated = envContent;
    for (const line of envLines) {
      const key = line.split('=')[0];
      const re = new RegExp(`^${key}=.*$`, 'm');
      if (re.test(updated)) updated = updated.replace(re, line);
      else updated = (updated.trimEnd() ? updated.trimEnd() + '\n' : '') + line + '\n';
    }
    if (updated !== envContent) {
      try {
        fs.writeFileSync(envPath, updated, 'utf8');
      } catch (e) {
        defaultLogger.warn('SMM Supabase replace: could not write', envPath, e.message);
      }
    }
  }
  defaultLogger.log('SMM Supabase: replaced URL and anon key in', fullPath);
}

module.exports = {
  getSupabaseConfig,
  createSupabaseProject,
  getSupabaseApiKeys,
  runSupabaseQuery,
  setupSupabaseForInstance,
  createSupabaseAuthUser,
  replaceSupabaseConfigInCodebase,
};
