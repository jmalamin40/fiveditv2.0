/**
 * Domain TLD pricing – get price for a domain name from domain_tld_pricing table.
 */

const pool = require('../config/database');

/**
 * Extract TLD from domain name (e.g. example.com -> com, sub.example.co.uk -> co.uk).
 * Simple: take last part after final dot. For co.uk we could use a list; for now keep it simple.
 */
function getTldFromDomain(domainName) {
  if (!domainName || typeof domainName !== 'string') return null;
  const cleaned = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const parts = cleaned.split('.');
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

/**
 * Get register price for a domain name. Returns null if TLD not found or disabled.
 */
async function getDomainPrice(domainName) {
  const tld = getTldFromDomain(domainName);
  if (!tld) return null;
  const [rows] = await pool.execute(
    'SELECT register_price, renew_price, currency FROM domain_tld_pricing WHERE tld = ? AND is_active = TRUE',
    [tld]
  );
  if (!rows.length) return null;
  return {
    tld,
    register_price: Number(rows[0].register_price),
    renew_price: Number(rows[0].renew_price),
    currency: rows[0].currency || 'BDT',
  };
}

/**
 * List all active TLDs with pricing (for checkout/display).
 */
async function listTldPricing() {
  const [rows] = await pool.execute(
    'SELECT tld, register_price, renew_price, currency FROM domain_tld_pricing WHERE is_active = TRUE ORDER BY sort_order ASC, tld ASC'
  );
  return rows.map((r) => ({
    tld: r.tld,
    register_price: Number(r.register_price),
    renew_price: Number(r.renew_price),
    currency: r.currency || 'BDT',
  }));
}

module.exports = {
  getTldFromDomain,
  getDomainPrice,
  listTldPricing,
};
