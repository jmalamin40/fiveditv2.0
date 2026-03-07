const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

export interface Service {
  id: string;
  icon: string;
  title: string;
  short: string;
  description: string;
  features: string[] | any; // Can be string[] or JSON parsed array
  color: 'blue' | 'cyan';
  category?: string;
  link?: string;
  plans?: ServicePlan[];
  categories?: string[];
}

export interface ServicePlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  deliveryTime: string;
  popular?: boolean;
  features: PlanFeature[];
}

export interface PlanFeature {
  name: string;
  included: boolean;
}

export interface Review {
  id: number;
  reviewerName: string;
  reviewerInitial: string;
  location: string;
  countryCode: string;
  isRepeatClient: boolean;
  rating: number;
  timePosted: string;
  reviewText: string;
  priceRange: string;
  duration: string;
  helpfulCount: number;
}

export interface HostingPackage {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  disk_space_gb: number;
  bandwidth_gb: number | null;
  domains: number | null;
  email_accounts: number | null;
  databases: number | null;
  ssl_included: boolean;
  backups: string | null;
  support_type: string | null;
  cpanel: boolean;
  wordpress: boolean;
  php_version: string | null;
  nodejs: boolean;
  python: boolean;
  popular: boolean;
  is_active: boolean;
}

export interface HostingOrder {
  order_id: string;
  transaction_id: string;
  payment_url: string;
  amount: number;
  currency: string;
}

export interface CodeCanyonScript {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  codecanyonUrl: string;
  imageUrl: string;
  plans?: ServicePlan[];
}

// API Functions
export async function fetchServices(): Promise<Service[]> {
  const response = await fetch(`${API_BASE_URL}/services`);
  if (!response.ok) {
    throw new Error('Failed to fetch services');
  }
  const data = await response.json();
  return data.services;
}

export async function fetchServiceById(id: string): Promise<Service> {
  const response = await fetch(`${API_BASE_URL}/services/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch service');
  }
  return response.json();
}

export async function fetchReviews(params?: {
  rating?: number;
  repeatClient?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ reviews: Review[]; pagination: any; stats: any }> {
  const queryParams = new URLSearchParams();
  if (params?.rating) queryParams.append('rating', params.rating.toString());
  if (params?.repeatClient !== undefined) queryParams.append('repeatClient', params.repeatClient.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const response = await fetch(`${API_BASE_URL}/reviews?${queryParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch reviews');
  }
  return response.json();
}

export async function updateReviewHelpful(id: number): Promise<{ helpfulCount: number }> {
  const response = await fetch(`${API_BASE_URL}/reviews/${id}/helpful`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to update helpful count');
  }
  return response.json();
}

export async function fetchCodeCanyonScripts(): Promise<CodeCanyonScript[]> {
  const response = await fetch(`${API_BASE_URL}/codecanyon`);
  if (!response.ok) {
    throw new Error('Failed to fetch scripts');
  }
  const data = await response.json();
  return data.scripts;
}

export async function fetchCodeCanyonScriptById(id: string): Promise<CodeCanyonScript> {
  const response = await fetch(`${API_BASE_URL}/codecanyon/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch script');
  }
  return response.json();
}

export async function fetchScriptsByCategory(category: string): Promise<CodeCanyonScript[]> {
  const response = await fetch(`${API_BASE_URL}/codecanyon/category/${category}`);
  if (!response.ok) {
    throw new Error('Failed to fetch scripts by category');
  }
  const data = await response.json();
  return data.scripts;
}

export async function fetchHostingPackages(): Promise<HostingPackage[]> {
  const url = `${API_BASE_URL}/hosting/packages`;
  console.log('[API] Fetching hosting packages from:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[API] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      console.error('[API] Error response:', errorData);
      throw new Error(errorData.error || `Failed to fetch hosting packages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[API] Packages received:', data.packages?.length || 0);
    return data.packages || [];
  } catch (error) {
    console.error('[API] Fetch error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to API at ${url}. Please check if the API server is running.`);
    }
    throw error;
  }
}

export async function fetchHostingPackage(id: number): Promise<HostingPackage> {
  const response = await fetch(`${API_BASE_URL}/hosting/packages/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch hosting package');
  }
  const data = await response.json();
  return data.package;
}

export async function createHostingOrder(data: {
  package_id: number;
  billing_period: 'monthly' | 'yearly';
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  domain?: string;
  username?: string;
}): Promise<HostingOrder> {
  // Get customer token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization header if customer is logged in
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}/hosting/payments/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create hosting order');
  }
  return response.json();
}

export async function getHostingOrderStatus(orderId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/hosting/payments/orders/${orderId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch order status');
  }
  return response.json();
}

// Customer Authentication
export interface CustomerUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'customer';
}

export interface CustomerLoginResponse {
  token: string;
  user: CustomerUser;
}

export async function customerRegister(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<CustomerLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/customer/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register');
  }
  return response.json();
}

export async function customerLogin(email: string, password: string): Promise<CustomerLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/customer/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to login');
  }
  return response.json();
}

// Customer Portal
export interface CustomerOrder {
  order_id: string;
  transaction_id: string;
  status: string;
  display_status?: string; // Normalized status for display (account status if available, otherwise order status)
  amount: number;
  currency: string;
  billing_period: string;
  package_name: string;
  domain?: string;
  username?: string;
  created_at: string;
  paid_at?: string;
  hosting_account_id?: number;
  package_display_name?: string;
  account_status?: string;
  disk_used?: number;
  disk_limit?: number;
  bandwidth_used?: number;
  bandwidth_limit?: number;
}

export interface CustomerAccount {
  id: number | null;
  domain: string;
  username: string;
  package_name: string;
  status: string;
  display_status?: string; // Normalized status for display
  disk_used: number;
  disk_limit: number;
  bandwidth_used: number;
  bandwidth_limit: number;
  ip_address?: string;
  created_at: string;
  expires_at?: string;
  order_id?: string;
  billing_period?: string;
  amount?: number;
  currency?: string;
  paid_at?: string;
  package_display_name?: string;
  order_status?: string;
}

export async function getCustomerOrders(token: string): Promise<{ orders: CustomerOrder[] }> {
  const response = await fetch(`${API_BASE_URL}/customer/orders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  return response.json();
}

export async function getCustomerAccounts(token: string): Promise<{ accounts: CustomerAccount[] }> {
  const response = await fetch(`${API_BASE_URL}/customer/accounts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  return response.json();
}

export async function getCustomerOrder(token: string, orderId: string): Promise<{ order: CustomerOrder }> {
  const response = await fetch(`${API_BASE_URL}/customer/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch order');
  }
  return response.json();
}

export async function getCustomerProfile(token: string): Promise<{ user: CustomerUser }> {
  const response = await fetch(`${API_BASE_URL}/customer/profile`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }
  return response.json();
}

export async function updateCustomerProfile(token: string, data: { name: string; phone?: string }): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/customer/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update profile');
  }
  return response.json();
}

// Invoice interfaces and functions
export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  billing_period?: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  order_id: number;
  customer_id?: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  paid_at?: string;
  notes?: string;
  invoice_items: InvoiceItem[];
  order_reference?: string;
  package_name?: string;
  billing_period?: string;
  domain?: string;
  username?: string;
  created_at: string;
  updated_at: string;
}

export async function getCustomerInvoices(token: string): Promise<{ invoices: Invoice[] }> {
  const response = await fetch(`${API_BASE_URL}/customer/invoices`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch invoices');
  }
  return response.json();
}

export async function getCustomerInvoice(token: string, invoiceId: string): Promise<{ invoice: Invoice }> {
  const response = await fetch(`${API_BASE_URL}/customer/invoices/${invoiceId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch invoice');
  }
  return response.json();
}

// SMM (Social Media Marketing) Website service
export interface SmmProduct {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval?: 'monthly' | 'yearly' | null;
  package_tier?: 'starter' | 'standard' | 'premium' | null;
  features?: string[] | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface SmmOrder {
  order_id: string;
  transaction_id?: string;
  status: string;
  amount: number;
  currency: string;
  domain?: string;
  subdomain_slug?: string;
  created_at: string;
  paid_at?: string;
  smm_instance_id?: number;
  product_display_name?: string;
}

export interface SmmInstance {
  id: number;
  domain: string;
  folder_name: string;
  folder_path: string;
  site_url: string;
  status: string;
  created_at: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  product_display_name?: string;
}

export async function fetchSmmProducts(): Promise<SmmProduct[]> {
  const response = await fetch(`${API_BASE_URL}/smm/products`);
  if (!response.ok) throw new Error('Failed to fetch SMM products');
  const data = await response.json();
  return data.products || [];
}

export async function fetchSmmProduct(id: number): Promise<SmmProduct> {
  const response = await fetch(`${API_BASE_URL}/smm/products/${id}`);
  if (!response.ok) throw new Error('Failed to fetch SMM product');
  const data = await response.json();
  return data.product;
}

export async function createSmmOrder(data: {
  product_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  domain?: string;
  subdomain_slug?: string;
  new_domain_name?: string;
}): Promise<{ order_id: string; payment_url: string; amount: number; currency: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/smm/payments/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create SMM order');
  }
  return response.json();
}

export async function getSmmOrderStatus(orderId: string): Promise<{ order: SmmOrder; instance?: SmmInstance }> {
  const response = await fetch(`${API_BASE_URL}/smm/payments/orders/${encodeURIComponent(orderId)}`);
  if (!response.ok) throw new Error('Failed to fetch SMM order');
  return response.json();
}

export async function getCustomerSmmOrders(token: string): Promise<{ orders: SmmOrder[] }> {
  const response = await fetch(`${API_BASE_URL}/customer/smm-orders`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch SMM orders');
  return response.json();
}

export async function getCustomerSmmInstances(token: string): Promise<{ instances: SmmInstance[] }> {
  const response = await fetch(`${API_BASE_URL}/customer/smm-instances`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch SMM instances');
  return response.json();
}

export interface SmmProvisioningStep {
  step_name: string;
  step_order: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  error_message?: string | null;
  details?: unknown;
  created_at: string;
  updated_at: string;
}

export async function getSmmProvisioningSteps(orderId: string): Promise<{ steps: SmmProvisioningStep[] }> {
  const response = await fetch(`${API_BASE_URL}/smm/payments/orders/${encodeURIComponent(orderId)}/provisioning`);
  if (!response.ok) throw new Error('Failed to fetch provisioning steps');
  return response.json();
}

export async function retrySmmProvisioning(orderId: string, token?: string | null): Promise<{ success: boolean; message?: string; steps?: SmmProvisioningStep[] }> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/smm/payments/provision-retry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ order_id: orderId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Retry failed');
  return data;
}

// Domain TLD pricing and domain-only orders
export interface DomainTldPrice {
  tld: string;
  register_price: number;
  renew_price: number;
  currency: string;
}

export async function getDomainTldPricing(): Promise<{ tlds: DomainTldPrice[] }> {
  const response = await fetch(`${API_BASE_URL}/domain/tld-pricing`);
  if (!response.ok) throw new Error('Failed to fetch domain pricing');
  return response.json();
}

export async function getDomainPrice(domainName: string): Promise<DomainTldPrice & { tld: string }> {
  const response = await fetch(`${API_BASE_URL}/domain/price?domain=${encodeURIComponent(domainName)}`);
  if (!response.ok) {
    const d = await response.json().catch(() => ({}));
    throw new Error(d.error || 'Domain price not available');
  }
  return response.json();
}

export async function createDomainOrder(data: {
  domain_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
}): Promise<{ order_id: string; payment_url: string; amount: number; currency: string; domain_name: string }> {
  const response = await fetch(`${API_BASE_URL}/domain/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create domain order');
  }
  return response.json();
}

export async function getSmmGuestSession(orderId: string): Promise<{ token: string; expires_at: string }> {
  const response = await fetch(`${API_BASE_URL}/smm/payments/orders/${encodeURIComponent(orderId)}/guest-session`);
  if (!response.ok) throw new Error('Failed to get session');
  return response.json();
}

export async function customerGuestLogin(token: string, orderId: string): Promise<{ token: string; user: { id: number; name: string; email: string; phone?: string; role: string } }> {
  const response = await fetch(`${API_BASE_URL}/customer/auth/guest-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, order_id: orderId }),
  });
  if (!response.ok) throw new Error('Failed to login');
  return response.json();
}

