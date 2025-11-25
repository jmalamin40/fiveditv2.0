const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fivedit.com/v1/api' || 'http://localhost:3001/api';

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

