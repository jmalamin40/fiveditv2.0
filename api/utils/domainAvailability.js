/**
 * Domain availability check via WHOIS.
 * Returns { available: boolean, domain: string } or throws.
 */

const whois = require('whois');
const { promisify } = require('util');

const whoisLookup = promisify(whois.lookup);

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
  /domain name:\s*\S+/i,   // "Domain Name: EXAMPLE.COM"
  /domain\s*name:\s*\S+/i, // alternate spacing
  /name server:/i,
  /creation date:/i,
  /updated date:/i,
  /registrar:/i,
  /registration date:/i,
  /registry domain id:/i,
  /expir(y|es)?\s*date:/i,
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

  // Check TAKEN first: if the response looks like a registered domain, it's not available.
  for (const p of TAKEN_PATTERNS) {
    if (p.test(text)) {
      return { available: false, domain };
    }
  }
  // Then check explicit "available" indicators (registrar-specific messages).
  for (const p of AVAILABLE_PATTERNS) {
    if (p.test(text)) {
      return { available: true, domain };
    }
  }
  // Only treat as available for very specific registrar "no match" phrases (avoid "available" - can match "available for renewal").
  const head = text.slice(0, 600);
  if (/no match for\s+["']?\S+\./i.test(head) || /\bno entries found\b/i.test(head) || /domain not found\s*$/im.test(head)) {
    return { available: true, domain };
  }
  // When in doubt, assume taken so we don't sell already-registered domains.
  return { available: false, domain };
}

module.exports = { checkDomainAvailability };
