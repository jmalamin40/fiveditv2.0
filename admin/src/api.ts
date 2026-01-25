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


