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


