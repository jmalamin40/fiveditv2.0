/**
 * Default public routes and support copy for the AI agent (seed + reset).
 * Keep in sync with app/ Next.js routes where possible.
 */
const DEFAULT_ROUTES = [
  { path: '/', title: 'Home', hint: 'Landing page; sections About, Technologies, Industries, Why Us via anchors on same page' },
  { path: '/services', title: 'Services catalog', hint: 'Browse all professional services by category' },
  { path: '/services/codecanyon', title: 'CodeCanyon scripts', hint: 'Licensed scripts, installation plans and pricing' },
  { path: '/hosting', title: 'Web hosting', hint: 'Compare hosting packages (disk, bandwidth, pricing)' },
  { path: '/hosting/checkout', title: 'Hosting checkout', hint: 'Start a hosting order (monthly/yearly)' },
  { path: '/hosting/payment/success', title: 'Hosting payment success', hint: 'Shown after successful hosting payment' },
  { path: '/hosting/payment/cancel', title: 'Hosting payment cancelled', hint: 'User returned from gateway without completing payment' },
  { path: '/domains', title: 'Domain search & registration', hint: 'Check availability and buy domains' },
  { path: '/smm', title: 'SMM website products', hint: 'Social media marketing website packages' },
  { path: '/smm/checkout', title: 'SMM checkout', hint: 'Purchase SMM website / configuration' },
  { path: '/smm/payment/success', title: 'SMM payment success', hint: 'After successful SMM payment' },
  { path: '/smm/payment/cancel', title: 'SMM payment cancelled', hint: 'Payment flow cancelled' },
  { path: '/contact', title: 'Contact & support', hint: 'Contact form; official email, phone, WhatsApp on this page' },
  { path: '/customer/login', title: 'Customer login', hint: 'Customer portal sign-in' },
  { path: '/customer/register', title: 'Customer register', hint: 'Create a customer account' },
  { path: '/customer', title: 'Customer dashboard', hint: 'Logged-in customer area (requires login)' },
  { path: '/domain/order/success', title: 'Domain order success', hint: 'After domain purchase submitted' },
];

const DYNAMIC_HINT =
  'Dynamic URLs: service detail is /services/{id} and script detail is /services/codecanyon/{id} where {id} matches the service or script id from the catalog.';

const DEFAULTS = {
  public_site_url: 'https://fivedit.com',
  support_email: 'info@fivedit.com',
  support_phone_display: '+880 1812 161440',
  whatsapp_e164: '8801812161440',
  contact_page_path: '/contact',
  support_notes:
    'Support is available 24/7. For fastest replies, customers can use WhatsApp or the contact form. Phone and email are also monitored.',
};

function getDefaultRoutesJson() {
  return JSON.stringify(DEFAULT_ROUTES, null, 0);
}

module.exports = {
  DEFAULT_ROUTES,
  DYNAMIC_HINT,
  DEFAULTS,
  getDefaultRoutesJson,
};
