const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { defaultLogger } = require('./logger');

/**
 * DirectAdmin API helper for SMM: create subdomain/domain using the same
 * DirectAdmin account configured in the admin portal (Hosting → DirectAdmin config).
 * Main domain DNS can be on Cloudflare; we only create the vhost in DirectAdmin.
 *
 * Config: read from hosting_config (same as hosting management). No SMM-specific env needed.
 * The DA account in the admin portal must be a user/reseller that owns the main domain
 * (e.g. fivedit.com) so it can create subdomains (yourname.fivedit.com) and extra domains.
 * Optional env: SMM_SUBDOMAIN_BASE (default fivedit.com), SMM_DA_HOME (default /home/<username>).
 */

function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.substring(0, 32), 'utf8');
  }
  return Buffer.from('default-encryption-key-32-chars!!', 'utf8');
}

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || encryptedPassword.length < 33) return '';
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedPassword.substring(0, 32), 'hex');
  const encrypted = encryptedPassword.substring(32);
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    defaultLogger.error('SMM DA: decrypt password failed', e.message);
    return '';
  }
}

/**
 * Get DirectAdmin config for SMM. Uses the same hosting_config from the admin portal.
 * Returns null if no active hosting_config.
 */
async function getSmmDaConfig(pool) {
  if (!pool) return null;
  try {
    const [rows] = await pool.execute(
      'SELECT whm_host, whm_username, whm_password_encrypted, whm_port, whm_ssl FROM hosting_config WHERE is_active = TRUE LIMIT 1'
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const password = decryptPassword(r.whm_password_encrypted);
    if (!password) {
      defaultLogger.warn('SMM DA: could not decrypt hosting_config password');
      return null;
    }
    const user = r.whm_username;
    const host = r.whm_host || 'localhost';
    const port = parseInt(r.whm_port || '2222', 10);
    const ssl = r.whm_ssl !== false && r.whm_ssl !== 0;
    return {
      host,
      port,
      ssl,
      user,
      password,
      home: process.env.SMM_DA_HOME || `/home/${user}`,
    };
  } catch (e) {
    defaultLogger.error('SMM DA: getSmmDaConfig failed', e.message);
    return null;
  }
}

/**
 * Make a DirectAdmin API request (Basic auth, URL-encoded response).
 * Resolves with parsed key=value result; rejects on HTTP error or error=1 in body.
 */
function makeSmmDaRequest(config, command, params = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${config.user}:${config.password}`).toString('base64');
    const useSSL = config.ssl !== false;
    const port = config.port || 2222;
    const hostname = config.host;

    const query = new URLSearchParams(params).toString();
    const pathStr = method === 'GET' && query ? `/${command}?${query}` : `/${command}`;
    const options = {
      hostname,
      port,
      path: pathStr,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      rejectUnauthorized: false,
    };

    if (method === 'POST') {
      const body = new URLSearchParams(params).toString();
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = (useSSL ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          defaultLogger.error(`SMM DA HTTP ${res.statusCode}:`, data.substring(0, 300));
          return reject(new Error(`DirectAdmin returned ${res.statusCode}: ${data.substring(0, 200)}`));
        }
        const result = {};
        const pairs = data.split('&').filter(Boolean);
        for (const pair of pairs) {
          const idx = pair.indexOf('=');
          if (idx > 0) {
            const key = decodeURIComponent(pair.substring(0, idx).trim());
            const value = decodeURIComponent(pair.substring(idx + 1).trim());
            if (value === 'yes') result[key] = true;
            else if (value === 'no') result[key] = false;
            else if (key === 'error') result[key] = value === '0' ? 0 : (parseInt(value, 10) || value);
            else result[key] = value;
          }
        }
        const err = result.error;
        if (err !== undefined && err !== 0 && err !== '0') {
          const msg = result.text || result.details || String(err);
          defaultLogger.error('SMM DA API error:', msg);
          return reject(new Error(msg || 'DirectAdmin API error'));
        }
        resolve(result);
      });
    });

    req.on('error', (err) => {
      defaultLogger.error('SMM DA request error:', err.message);
      reject(err);
    });

    if (method === 'POST' && Object.keys(params).length > 0) {
      req.write(new URLSearchParams(params).toString());
    }
    req.end();
  });
}

/**
 * Create a subdomain under the given domain (e.g. domain=fivedit.com, subdomain=yourname).
 * Uses CMD_API_SUBDOMAINS with action=create.
 */
async function createSubdomainInDirectAdmin(config, domain, subdomain) {
  defaultLogger.log(`SMM DA: creating subdomain ${subdomain}.${domain}`);
  await makeSmmDaRequest(config, 'CMD_API_SUBDOMAINS', {
    action: 'create',
    domain: domain.replace(/^https?:\/\//, '').split('/')[0],
    subdomain: subdomain,
  }, 'POST');
  const docroot = `${config.home}/domains/${domain}/public_html/${subdomain}`;
  defaultLogger.log(`SMM DA: subdomain created, docroot=${docroot}`);
  return docroot;
}

/**
 * Create an additional domain for the user (e.g. customerdomain.com).
 * Uses CMD_API_DOMAIN with action=create.
 */
async function createDomainInDirectAdmin(config, domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  defaultLogger.log(`SMM DA: creating domain ${cleanDomain}`);
  await makeSmmDaRequest(config, 'CMD_API_DOMAIN', {
    action: 'create',
    domain: cleanDomain,
    ubandwidth: 'unlimited',
    uquota: 'unlimited',
    ssl: 'ON',
    php: 'ON',
    cgi: 'OFF',
  }, 'POST');
  const docroot = `${config.home}/domains/${cleanDomain}/public_html`;
  defaultLogger.log(`SMM DA: domain created, docroot=${docroot}`);
  return docroot;
}

/**
 * Return the document root path for a domain (and optional subdomain).
 */
function getDaDocroot(config, domain, subdomain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  if (subdomain) {
    return `${config.home}/domains/${cleanDomain}/public_html/${subdomain}`;
  }
  return `${config.home}/domains/${cleanDomain}/public_html`;
}

/** Fixed SMM docroot: always use domains/social-smm.fivedit.com/public_html (env SMM_DA_DOCROOT), no subfolder. */
const SMM_DA_DOCROOT = process.env.SMM_DA_DOCROOT || 'domains/social-smm.fivedit.com/public_html';

function getSmmFixedDocroot(config) {
  return config.home + '/' + SMM_DA_DOCROOT.replace(/\/+$/, '');
}

/**
 * Add a domain pointer in DirectAdmin so the given domain uses the same document root
 * as the account (e.g. social-smm.fivedit.com → /home/user/domains/social-smm.fivedit.com/public_html).
 * Uses CMD_API_DOMAIN_POINTER with action=add. The DA user's main domain should be the one
 * that has the fixed docroot (set via SMM_DA_DOCROOT).
 */
async function addSmmDomainPointer(config, pointerDomain) {
  const name = pointerDomain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  if (!name) {
    defaultLogger.warn('SMM DA: skip domain pointer, empty domain');
    return;
  }
  defaultLogger.log(`SMM DA: adding domain pointer: ${name} (docroot: ${getSmmFixedDocroot(config)})`);
  await makeSmmDaRequest(config, 'CMD_API_DOMAIN_POINTER', {
    action: 'add',
    name: name,
  }, 'POST');
  defaultLogger.log(`SMM DA: domain pointer added: ${name}`);
}

module.exports = {
  getSmmDaConfig,
  makeSmmDaRequest,
  createSubdomainInDirectAdmin,
  createDomainInDirectAdmin,
  getDaDocroot,
  getSmmFixedDocroot,
  addSmmDomainPointer,
};
