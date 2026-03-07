/**
 * Domain availability check via WHOIS.
 * Tries the whois package (dynamic import); if that fails (e.g. ESM on live server),
 * falls back to built-in net-based WHOIS so it works everywhere.
 * Returns { available: boolean, domain: string } or throws.
 */

const net = require('net');
const { promisify } = require('util');

const IANA_WHOIS = 'whois.iana.org';
const WHOIS_PORT = 43;
const SOCKET_TIMEOUT_MS = 10000;
const IDLE_MS = 1800;

let whoisLookupCached = null;
let useBuiltinWhois = false;

/** Built-in WHOIS over TCP (no ESM package). */
function whoisQuery(host, query) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    let idleTimer = null;
    function finish() {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      try { socket.destroy(); } catch (_) {}
      resolve(chunks.join(''));
    }
    const socket = net.createConnection(WHOIS_PORT, host, () => {
      socket.write(query.trim() + '\r\n');
    });
    socket.setEncoding('utf8');
    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, IDLE_MS);
    });
    socket.on('end', finish);
    socket.on('timeout', () => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      socket.destroy();
      reject(new Error('WHOIS timeout'));
    });
    socket.on('error', reject);
  });
}

function parseWhoisReferral(text) {
  const lines = (text || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(?:refer|whois\s*server|whois):\s*(\S+)/i);
    if (m) {
      const host = m[1].trim().replace(/\/.*$/, '').replace(/:\d+$/, '');
      if (host.length > 0 && /^[a-z0-9.-]+$/i.test(host)) return host;
    }
  }
  return null;
}

/** Built-in WHOIS lookup: IANA referral then TLD server. */
async function builtinWhoisLookup(domain) {
  const normalized = domain.trim().toLowerCase();
  const tld = normalized.split('.').pop();
  let text = '';
  try {
    const ianaResponse = await whoisQuery(IANA_WHOIS, tld);
    const whoisServer = parseWhoisReferral(ianaResponse);
    if (whoisServer) {
      text = await whoisQuery(whoisServer, normalized);
    } else {
      text = ianaResponse;
    }
  } catch (_) {
    try {
      text = await whoisQuery(IANA_WHOIS, normalized);
    } catch (e) {
      throw e;
    }
  }
  return text;
}

async function getWhoisLookup() {
  if (useBuiltinWhois) return 'builtin';
  if (whoisLookupCached) return whoisLookupCached;
  try {
    const whois = await import('whois');
    const mod = whois.default != null ? whois.default : whois;
    const lookup = typeof mod.lookup === 'function' ? mod.lookup : (typeof mod === 'function' ? mod : null);
    if (typeof lookup !== 'function') throw new Error('whois package: lookup not found');
    whoisLookupCached = promisify(lookup);
    return whoisLookupCached;
  } catch (e) {
    const msg = e && e.message ? String(e.message) : '';
    if (/Cannot use import statement|outside a module|lookup not found/i.test(msg)) {
      useBuiltinWhois = true;
      return 'builtin';
    }
    throw e;
  }
}

const AVAILABLE_PATTERNS = [
  /no match for\s+/i,
  /status:\s*available\b/i,
  /is free\b/i,
  /available for registration/i,
  /domain not found\b/i,
  /no (?:entries|object|data) found/i,
  /nothing found\b/i,
];

const TAKEN_PATTERNS = [
  /domain name:\s*\S+/i,
  /domain\s*name:\s*\S+/i,
  /name server:/i,
  /creation date:/i,
  /updated date:/i,
  /registrar:/i,
  /registration date:/i,
  /registry domain id:/i,
  /expir(y|es)?\s*date:/i,
];

function interpretWhoisText(text, domain) {
  for (const p of TAKEN_PATTERNS) {
    if (p.test(text)) return { available: false, domain };
  }
  if (/^\s*refer\s*:/im.test(text) && !/domain\s*name\s*:/i.test(text)) {
    return { available: false, domain };
  }
  for (const p of AVAILABLE_PATTERNS) {
    if (p.test(text)) return { available: true, domain };
  }
  const head = text.slice(0, 800);
  if (/no match for\s+["']?\S+\./i.test(head) || /\bno entries found\b/i.test(head) || /domain not found\s*$/im.test(head)) {
    return { available: true, domain };
  }
  return { available: false, domain };
}

async function checkDomainAvailability(domainName) {
  if (!domainName || typeof domainName !== 'string') {
    throw new Error('Domain name is required');
  }
  const domain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!domain || !domain.includes('.')) {
    throw new Error('Invalid domain name');
  }

  const lookup = await getWhoisLookup();
  let text = '';

  if (lookup === 'builtin') {
    text = await builtinWhoisLookup(domain);
  } else {
    const raw = await lookup(domain, { timeout: 10000 });
    text = (raw || '').toString();
  }

  return interpretWhoisText(text, domain);
}

module.exports = { checkDomainAvailability };
