import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fivedit.com/api' || 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE_URL,
});

const authHeaders = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface PlanFeatureInput {
  name: string;
  included?: boolean;
}

export interface ServicePlanInput {
  id: string;
  name: string;
  price: number;
  currency?: string;
  description?: string;
  deliveryTime?: string;
  popular?: boolean;
  features?: PlanFeatureInput[];
}

export interface ServiceInput {
  id?: string;
  icon: string;
  title: string;
  short?: string;
  description?: string;
  features?: string[];
  color?: 'blue' | 'cyan';
  categoryId?: string;
  link?: string;
  plans?: ServicePlanInput[];
}

export interface ScriptInput {
  id?: string;
  name: string;
  category?: string;
  shortDescription?: string;
  description?: string;
  codecanyonUrl?: string;
  imageUrl?: string;
  plans?: ServicePlanInput[];
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export async function login(email: string, password: string) {
  const { data } = await client.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

// Categories
export async function fetchCategories(token: string) {
  const { data } = await client.get<Category[]>('/admin/categories', authHeaders(token));
  return data;
}

export async function createCategory(token: string, payload: Partial<Category>) {
  const { data } = await client.post<Category>('/admin/categories', payload, authHeaders(token));
  return data;
}

export async function updateCategory(token: string, id: string, payload: Partial<Category>) {
  const { data } = await client.put<Category>(`/admin/categories/${id}`, payload, authHeaders(token));
  return data;
}

export async function deleteCategory(token: string, id: string) {
  await client.delete(`/admin/categories/${id}`, authHeaders(token));
}

// Services
export async function fetchServices(token: string) {
  const { data } = await client.get('/admin/services', authHeaders(token));
  return data;
}

export async function createService(token: string, payload: ServiceInput) {
  const { data } = await client.post('/admin/services', payload, authHeaders(token));
  return data;
}

export async function updateService(token: string, id: string, payload: ServiceInput) {
  const { data } = await client.put(`/admin/services/${id}`, payload, authHeaders(token));
  return data;
}

export async function deleteService(token: string, id: string) {
  await client.delete(`/admin/services/${id}`, authHeaders(token));
}

// CodeCanyon Scripts
export async function fetchScripts(token: string) {
  const { data } = await client.get('/admin/codecanyon', authHeaders(token));
  return data;
}

export async function createScript(token: string, payload: ScriptInput) {
  const { data } = await client.post('/admin/codecanyon', payload, authHeaders(token));
  return data;
}

export async function updateScript(token: string, id: string, payload: ScriptInput) {
  const { data } = await client.put(`/admin/codecanyon/${id}`, payload, authHeaders(token));
  return data;
}

export async function deleteScript(token: string, id: string) {
  await client.delete(`/admin/codecanyon/${id}`, authHeaders(token));
}

// Chat interfaces
export interface ChatSession {
  id: string;
  user_identifier: string | null;
  status: 'active' | 'closed' | 'pending';
  message_count: number;
  unread_count: number;
  last_message_time: string | null;
  last_message_at: string;
  created_at: string;
  is_new_traffic?: boolean;
  is_online?: boolean;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  message: string;
  sender_type: 'user' | 'admin';
  sender_id: number | null;
  is_read: boolean;
  created_at: string;
}

// Chat API functions
export interface ChatSessionsResponse {
  sessions: ChatSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ChatSessionsFilters {
  status?: 'active' | 'closed' | 'pending';
  online_status?: 'all' | 'online' | 'offline';
  is_new_traffic?: boolean;
  has_unread?: boolean;
  page?: number;
  limit?: number;
}

export async function fetchChatSessions(
  token: string, 
  filters?: ChatSessionsFilters
): Promise<ChatSessionsResponse> {
  const params = new URLSearchParams();
  
  if (filters?.status) params.append('status', filters.status);
  if (filters?.online_status && filters.online_status !== 'all') {
    params.append('online_status', filters.online_status);
  }
  if (filters?.is_new_traffic === true) {
    params.append('is_new_traffic', 'true');
  }
  if (filters?.has_unread === true) {
    params.append('has_unread', 'true');
  }
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  
  const url = `/chat/admin/sessions${params.toString() ? '?' + params.toString() : ''}`;
  const { data } = await client.get<ChatSessionsResponse>(url, authHeaders(token));
  return data;
}

export async function fetchChatMessages(token: string, sessionId: string) {
  const { data } = await client.get<ChatMessage[]>(`/chat/admin/sessions/${sessionId}/messages`, authHeaders(token));
  return data;
}

export async function sendAdminMessage(token: string, sessionId: string, message: string) {
  const { data } = await client.post<ChatMessage>('/chat/admin/messages', {
    sessionId,
    message
  }, authHeaders(token));
  return data;
}

export async function updateSessionStatus(token: string, sessionId: string, status: 'active' | 'closed' | 'pending') {
  const { data } = await client.put(`/chat/admin/sessions/${sessionId}/status`, { status }, authHeaders(token));
  return data;
}

export async function fetchUnreadCount(token: string) {
  const { data } = await client.get<{ count: number }>('/chat/admin/unread-count', authHeaders(token));
  return data;
}

// Online status interfaces
export interface OnlineStatus {
  user: {
    is_online: boolean;
    last_seen: string | null;
  };
  admin?: {
    is_online: boolean;
    online_count: number;
    last_seen: string | null;
  };
}

// Online status API functions
export async function updateAdminOnlineStatus(token: string) {
  const { data } = await client.post<{ success: boolean; online: boolean }>('/chat/admin/online-status', {}, authHeaders(token));
  return data;
}

export async function fetchUserOnlineStatus(token: string, sessionId: string) {
  const { data } = await client.get<OnlineStatus>(`/chat/admin/sessions/${sessionId}/online-status`, authHeaders(token));
  return data;
}

// Firebase push notifications config
export interface FirebaseConfig {
  is_enabled: boolean;
  service_account_json: string;
  client_config_json: string;
  vapid_key?: string;
}

export interface FirebaseClientConfig {
  enabled: boolean;
  config?: Record<string, unknown>;
  vapidKey?: string | null;
}

/** Public endpoint - no auth. Used to init FCM and get token. */
export async function getFirebaseClientConfig() {
  const { data } = await client.get<FirebaseClientConfig>('/chat/firebase-client-config');
  return data;
}

export async function getFirebaseConfig(token: string) {
  const { data } = await client.get<FirebaseConfig>('/chat/admin/firebase-config', authHeaders(token));
  return data;
}

export async function updateFirebaseConfig(token: string, payload: FirebaseConfig) {
  const { data } = await client.put<{ success: boolean }>('/chat/admin/firebase-config', payload, authHeaders(token));
  return data;
}

export async function registerAdminFcmToken(token: string, fcmToken: string) {
  const { data } = await client.post<{ success: boolean }>('/chat/admin/fcm-token', { token: fcmToken }, authHeaders(token));
  return data;
}

// Cloudflare config (SMM subdomain DNS)
export interface CloudflareConfig {
  is_enabled: boolean;
  api_token: string;
  zone_id: string;
  base_domain: string;
  record_type: 'A' | 'CNAME';
  target_value: string;
  proxied: boolean;
}

export async function getCloudflareConfig(token: string) {
  const { data } = await client.get<CloudflareConfig>('/admin/cloudflare-config', authHeaders(token));
  return data;
}

export async function updateCloudflareConfig(token: string, payload: CloudflareConfig) {
  const { data } = await client.put<{ success: boolean }>('/admin/cloudflare-config', payload, authHeaders(token));
  return data;
}

// Domain reseller config & TLD pricing
export interface DomainResellerConfig {
  id: number;
  is_enabled: boolean;
  provider: string | null;
  api_url: string | null;
  api_key: string | null;
  api_secret: string | null;
  reseller_customer_id: string | null;
  default_currency: string;
  use_sandbox?: boolean;
  updated_at: string | null;
}

export interface DomainTldPricingRow {
  id: number;
  tld: string;
  register_price: number;
  renew_price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getDomainResellerConfig(token: string) {
  const { data } = await client.get<DomainResellerConfig>('/admin/domain/config', authHeaders(token));
  return data;
}

export async function updateDomainResellerConfig(token: string, payload: Partial<DomainResellerConfig>) {
  const { data } = await client.put<{ success: boolean }>('/admin/domain/config', payload, authHeaders(token));
  return data;
}

export async function fetchDomainTldPricing(token: string) {
  const { data } = await client.get<{ tlds: DomainTldPricingRow[] }>('/admin/domain/tld-pricing', authHeaders(token));
  return data;
}

export async function createDomainTld(token: string, payload: { tld: string; register_price: number; renew_price: number; currency?: string; is_active?: boolean; sort_order?: number }) {
  const { data } = await client.post<{ success: boolean; id: number }>('/admin/domain/tld-pricing', payload, authHeaders(token));
  return data;
}

export async function updateDomainTld(token: string, id: number, payload: Partial<{ tld: string; register_price: number; renew_price: number; currency: string; is_active: boolean; sort_order: number }>) {
  const { data } = await client.put<{ success: boolean }>(`/admin/domain/tld-pricing/${id}`, payload, authHeaders(token));
  return data;
}

export async function deleteDomainTld(token: string, id: number) {
  await client.delete(`/admin/domain/tld-pricing/${id}`, authHeaders(token));
}

/** Dynadot cost prices (what Dynadot charges the reseller) from Legacy tld_price API */
export interface DynadotTldCost {
  tld: string;
  register: number;
  renew: number;
  transfer: number;
}

export async function fetchDynadotTldPrices(token: string, currency?: string) {
  const params = currency ? { currency } : {};
  const { data } = await client.get<{ currency: string; priceLevel?: string; tlds: DynadotTldCost[] }>(
    '/admin/domain/dynadot-tld-prices',
    { ...authHeaders(token), params }
  );
  return data;
}

// Admin Profile interfaces
export interface AdminProfile {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  created_at: string;
}

// Admin Profile API functions
export async function fetchAdminProfile(token: string) {
  const { data } = await client.get<AdminProfile>('/admin/profile', authHeaders(token));
  return data;
}

export async function uploadProfilePicture(token: string, formData: FormData) {
  const { data } = await client.post<{ success: boolean; profile_picture: string }>(
    '/admin/profile/picture',
    formData,
    {
      ...authHeaders(token),
      headers: {
        ...authHeaders(token).headers,
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return data;
}

// Active Admins interface
export interface ActiveAdmin {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  last_seen: string;
}

export interface ActiveAdminsResponse {
  count: number;
  admins: ActiveAdmin[];
}

export async function fetchActiveAdmins() {
  const { data } = await client.get<ActiveAdminsResponse>('/admin/active-admins');
  return data;
}

// Invoice interfaces
export interface Invoice {
  id: number;
  invoice_id?: string; // API might return invoice_number instead
  invoice_number?: string; // Some APIs use this
  customer_id: number;
  order_id: number | null;
  order_reference?: string;
  package_name?: string;
  billing_period?: string;
  customer_name_full?: string;
  due_date: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_items?: any;
  notes?: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceFilters {
  status?: string;
  customer_id?: number;
  page?: number;
  limit?: number;
}

// Invoice API functions
export async function fetchInvoices(token: string, filters?: InvoiceFilters): Promise<InvoiceListResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.customer_id) params.append('customer_id', filters.customer_id.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  
  const url = `/admin/invoices${params.toString() ? '?' + params.toString() : ''}`;
  const { data } = await client.get<InvoiceListResponse>(url, authHeaders(token));
  return data;
}

export async function fetchInvoice(token: string, invoiceId: number) {
  const { data } = await client.get<{ invoice: Invoice }>(`/admin/invoices/${invoiceId}`, authHeaders(token));
  return data;
}

export async function updateInvoiceStatus(token: string, invoiceId: number, status: string, notes?: string) {
  const { data } = await client.put<{ success: boolean; message: string }>(
    `/admin/invoices/${invoiceId}/status`,
    { status, notes },
    authHeaders(token)
  );
  return data;
}

export async function generateInvoiceForOrder(token: string, orderId: number) {
  const { data } = await client.post<{ invoice: Invoice; message: string }>(
    `/admin/invoices/generate/${orderId}`,
    {},
    authHeaders(token)
  );
  return data;
}


