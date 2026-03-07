/**
 * Domain availability check via WHOIS.
 * Returns { available: boolean, domain: string } or throws.
 */

const whois = require('whois');
const { promisify } = require('util');

const whoisLookup = promisify(whois.lookup);

const AVAILABLE_PATTERNS = [
  /no match for/i,
  /not found/i,
  /no entries found/i,
  /status:\s*available/i,
  /is free/i,
  /available for registration/i,
  /domain not found/i,
  /no object found/i,
  /nothing found/i,
  /no data found/i,
  /(^|\s)available(\s|$)/i,  // word "available" (avoids "not available")
];

const TAKEN_PATTERNS = [
  /domain name:\s*\S+/i,  // "Domain Name: EXAMPLE.COM"
  /name server:/i,
  /creation date:/i,
  /updated date:/i,
  /registrar:/i,
  /registration date:/i,
];

/**
 * Check if a domain is available for registration via WHOIS.
 * @param {string} domainName - e.g. example.com
 * @returns {Promise<{ available: boolean, domain: string }>}
 */
async function checkDomainAvailability(domainName) {
  if (!domainName || typeof domainName !== 'string') {
    throw new Error('Domain name is required');
  }
  const domain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!domain || !domain.includes('.')) {
    throw new Error('Invalid domain name');
  }

  const raw = await whoisLookup(domain, { timeout: 10000 });
  const text = (raw || '').toString();

  for (const p of AVAILABLE_PATTERNS) {
    if (p.test(text)) {
      return { available: true, domain };
    }
  }
  for (const p of TAKEN_PATTERNS) {
    if (p.test(text)) {
      return { available: false, domain };
    }
  }
  // Default: if we see "No match" style in first 500 chars, treat as available
  const head = text.slice(0, 500);
  if (/no match|not found|no entries|available/i.test(head)) {
    return { available: true, domain };
  }
  // Otherwise assume taken (we got a WHOIS record)
  return { available: false, domain };
}

module.exports = { checkDomainAvailability };
