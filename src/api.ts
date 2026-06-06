import type {
  CompanySettings,
  OrderCreatePayload,
  PointHistory,
  PromotionRedemptionRequest,
  SlipAnalysisResult,
  SlipAnalyzeRequest,
} from './types';
import { getCurrentCompany } from './lib/company';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

async function request<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
  const company = getCurrentCompany();
  const headers: Record<string, string> = {
    'X-Company-Code': company.code,
    'X-Company-Id': String(company.id),
  };

  if (body) {
    Object.assign(headers, DEFAULT_HEADERS);
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function createApiClient(base: string) {
  return {
    getUsers: (search?: string, showAll = false) =>
      request<any[]>(
        base,
        'GET',
        `/users?${search ? `search=${encodeURIComponent(search)}&` : ''}${showAll ? 'showAll=1' : ''}`
      ),
    createUser: (data: {
      lineId: string; name: string; phone?: string;
      email?: string; avatar?: string; birthday?: string;
    }) => request<any>(base, 'POST', '/users', data),
    updateUser: (id: string, data: {
      lineId: string;
      name: string; phone?: string; email?: string; avatar?: string; birthday?: string;
      tier?: string; points?: number; totalSpent?: number;
    }) => request<any>(base, 'PUT', `/users/${id}`, data),
    setUserStatus: (id: string, isActive: boolean) =>
      request<any>(base, 'PATCH', `/users/${id}/status`, { isActive }),

    // Tiers
    getTiers:   () => request<any[]>(base, 'GET', '/tiers'),
    createTier: (data: { name: string; minPoints: number; multiplier: number; color: string; benefits: string[]; bahtPerPoint: number; discountPercent: number; durationDays: number }) =>
      request<any>(base, 'POST', '/tiers', data),
    updateTier: (id: string, data: { name: string; minPoints: number; multiplier: number; color: string; benefits: string[]; bahtPerPoint: number; discountPercent: number; durationDays: number }) =>
      request<any>(base, 'PUT', `/tiers/${id}`, data),
    deleteTier: (id: string) => request<any>(base, 'DELETE', `/tiers/${id}`),

    // Promotions
    getPromotions: (status?: 'active' | 'inactive') =>
      request<any[]>(base, 'GET', `/promotions${status ? `?status=${status}` : ''}`),
    redeemPromotion: (id: string, data: { userId?: string; lineId?: string }) =>
      request<any>(base, 'POST', `/promotions/${id}/redeem`, data),
    createPromotion: (data: object) => request<any>(base, 'POST', '/promotions', data),
    updatePromotion: (id: string, data: object) => request<any>(base, 'PUT', `/promotions/${id}`, data),
    deletePromotion: (id: string) => request<any>(base, 'DELETE', `/promotions/${id}`),
    getPromotionRequests: (status?: 'pending' | 'approved' | 'rejected' | 'all') =>
      request<PromotionRedemptionRequest[]>(base, 'GET', `/promotion-requests${status ? `?status=${status}` : ''}`),
    approvePromotionRequest: (id: string, data?: { reviewNote?: string }) =>
      request<PromotionRedemptionRequest>(base, 'PATCH', `/promotion-requests/${id}/approve`, data || {}),
    rejectPromotionRequest: (id: string, data?: { reviewNote?: string }) =>
      request<PromotionRedemptionRequest>(base, 'PATCH', `/promotion-requests/${id}/reject`, data || {}),

    // Orders
    getOrders: (limit = 200, status?: string) =>
      request<any[]>(base, 'GET', `/orders?limit=${limit}${status ? `&status=${status}` : ''}`),
    getOrder:  (id: string) => request<any>(base, 'GET', `/orders/${id}`),
    createOrder: (data: OrderCreatePayload) => request<any>(base, 'POST', '/orders', data),
    updateOrder: (id: string, data: OrderCreatePayload) => request<any>(base, 'PUT', `/orders/${id}`, data),
    setOrderStatus: (id: string, status: string) => request<any>(base, 'PATCH', `/orders/${id}/status`, { status }),
    deleteOrder: (id: string) => request<any>(base, 'DELETE', `/orders/${id}`),

    // Products
    getProducts: (search?: string, showAll = false) =>
      request<any[]>(
        base,
        'GET',
        `/products?${search ? `search=${encodeURIComponent(search)}&` : ''}${showAll ? 'showAll=1' : ''}`
      ),
    createProduct: (data: object) => request<any>(base, 'POST', '/products', data),
    updateProduct: (id: string, data: object) => request<any>(base, 'PUT', `/products/${id}`, data),
    setProductStatus: (id: string, isActive: boolean) => request<any>(base, 'PATCH', `/products/${id}/status`, { isActive }),
    deleteProduct: (id: string) => request<any>(base, 'DELETE', `/products/${id}`),

    // Dashboard
    getDashboard: () => request<any>(base, 'GET', '/dashboard'),
    getSettings: () => request<CompanySettings>(base, 'GET', '/settings'),
    updateSettings: (data: { pointExpiryDays: number }) => request<CompanySettings>(base, 'PUT', '/settings', data),

    // Staff
    getStaff: () => request<any[]>(base, 'GET', '/staff'),
    createStaff: (data: { username: string; displayName: string; password: string; role: string }) =>
      request<any>(base, 'POST', '/staff', data),
    updateStaff: (id: string, data: { username?: string; displayName?: string; password?: string; role?: string; isActive?: boolean }) =>
      request<any>(base, 'PATCH', `/staff/${id}`, data),
    resetStaffPassword: (id: string, password: string) =>
      request<any>(base, 'POST', `/staff/${id}/reset-password`, { password }),
  };
}

export const api = createApiClient('/api/admin');
export const publicApi = {
  getUsers: (search?: string, showAll = false) =>
    request<any[]>(
      '/api/public',
      'GET',
      `/users?${search ? `search=${encodeURIComponent(search)}&` : ''}${showAll ? 'showAll=1' : ''}`
    ),
  createUser: (data: {
    lineId: string; name: string; phone?: string;
    email?: string; avatar?: string; birthday?: string;
  }) => request<any>('/api/public', 'POST', '/users', data),
    getUserOrders: (id: string) => request<any[]>(`/api/public`, 'GET', `/users/${id}/orders`),
    getUserRedemptions: (id: string) => request<any[]>(`/api/public`, 'GET', `/users/${id}/redemptions`),
    getUserPoints: (id: string) => request<PointHistory[]>(`/api/public`, 'GET', `/users/${id}/points`),
    getTiers:   () => request<any[]>('/api/public', 'GET', '/tiers'),
    getCompanySettings: () => request<CompanySettings>('/api/public', 'GET', '/settings'),
    getPromotions: (status?: 'active' | 'inactive') =>
      request<any[]>('/api/public', 'GET', `/promotions${status ? `?status=${status}` : ''}`),
    redeemPromotion: (id: string, data: { userId?: string; lineId?: string }) =>
      request<any>('/api/public', 'POST', `/promotions/${id}/redeem`, data),
  analyzeSlip: (data: SlipAnalyzeRequest) =>
    request<SlipAnalysisResult>('/api/public', 'POST', '/slips/analyze', data),
  createOrder: (data: OrderCreatePayload) => request<any>('/api/public', 'POST', '/orders', data),
};

export const authApi = {
  status: () => request<{ hasStaff: boolean }>('/api/auth', 'GET', '/status'),
  me: () => request<{ user: any }>('/api/auth', 'GET', '/me'),
  login: (username: string, password: string) =>
    request<{ user: any }>('/api/auth', 'POST', '/login', { username, password }),
  logout: () => request<{ ok: boolean }>('/api/auth', 'POST', '/logout'),
  bootstrap: (data: { displayName: string; username: string; password: string }) =>
    request<{ user: any }>('/api/auth', 'POST', '/bootstrap', data),
  getRoles: () => request<{ roles: string[] }>('/api/auth', 'GET', '/roles'),
};
