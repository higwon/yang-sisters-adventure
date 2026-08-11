import type { Dashboard, Expense, PlanningItem, ScheduleItem } from './domain';

let selectedTripId: number | null = null;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();
const cacheTtlMs = 30_000;
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') {
    const cached = responseCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const pending = pendingRequests.get(url);
    if (pending) return pending as Promise<T>;
  } else {
    responseCache.clear();
  }
  const isFormData = init?.body instanceof FormData;
  const run = (async () => {
    const response = await fetch(url, {
      ...init,
      headers: { ...(isFormData ? {} : { 'content-type': 'application/json' }), ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: '요청에 실패했습니다.' })) as { error?: string };
      throw new Error(body.error ?? '요청에 실패했습니다.');
    }
    const value = await response.json() as T;
    if (method === 'GET') responseCache.set(url, { expiresAt: Date.now() + cacheTtlMs, value });
    return value;
  })();
  if (method === 'GET') pendingRequests.set(url, run);
  try { return await run; }
  finally { if (method === 'GET') pendingRequests.delete(url); }
};

export interface AuthUser { id: number; name: string; email: string; avatar_color: string; avatar_key: string | null }
export interface SelectableProfile { id: number; name: string; avatar_color: string; avatar_key: string | null }
const tripRequest = <T>(path: string, init?: RequestInit) => {
  if (selectedTripId === null) throw new Error('여행을 먼저 선택해 주세요.');
  return request<T>(`/api/trips/${selectedTripId}${path}`, init);
};
const authRequest = <T>(path: string, init?: RequestInit) => request<T>(`/api/auth${path}`, init);

export interface TripSummary {
  id: number; name: string; destination: string; country_code: string;
  start_date: string; end_date: string; timezone: string;
  default_currency: string; role: 'owner' | 'member';
}
export interface TripMember extends AuthUser { role: 'owner' | 'member' }

export const api = {
  setTrip: (tripId: number | null) => { if (selectedTripId !== tripId) responseCache.clear(); selectedTripId = tripId; },
  trips: () => request<{ trips: TripSummary[] }>('/api/trips'),
  createTrip: (data: Omit<TripSummary, 'id' | 'role' | 'default_currency'>) => request<{ trip: TripSummary }>('/api/trips', { method: 'POST', body: JSON.stringify(data) }),
  tripMembers: (tripId: number) => request<{ members: TripMember[]; can_manage: boolean }>(`/api/trips/${tripId}/members`),
  addTripMember: (tripId: number, userId: number) => request<{ ok: boolean }>(`/api/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeTripMember: (tripId: number, userId: number) => request<{ ok: boolean }>(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' }),
  deleteTrip: (tripId: number) => request<{ ok: boolean }>(`/api/trips/${tripId}`, { method: 'DELETE' }),
  updateTrip: (tripId: number, data: unknown) => request<{ ok: boolean }>(`/api/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  me: () => authRequest<{ user: AuthUser }>('/me'),
  profiles: () => authRequest<{ profiles: SelectableProfile[] }>('/profiles'),
  selectProfile: (user_id: number) => authRequest<{ user: AuthUser }>('/profile', { method: 'POST', body: JSON.stringify({ user_id }) }),
  logout: () => authRequest<{ ok: boolean }>('/logout', { method: 'POST' }),
  updateMe: (name: string) => authRequest<{ user: AuthUser }>('/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
  uploadAvatar: (file: File) => { const body = new FormData(); body.set('file', file); return request<{ avatar_key: string }>('/api/auth/me/avatar', { method: 'POST', body, headers: {} }); },
  removeAvatar: () => authRequest<{ ok: boolean }>('/me/avatar', { method: 'DELETE' }),
  avatarUrl: (userId: number, avatarKey?: string | null) => avatarKey ? `/api/auth/profiles/${userId}/avatar?v=${encodeURIComponent(avatarKey)}` : null,
  dashboard: () => tripRequest<Dashboard>('/dashboard'),
  schedule: () => tripRequest<ScheduleItem[]>('/schedule'),
  planning: () => tripRequest<PlanningItem[]>('/planning'),
  schedulePlanning: (id: number, data: unknown) => tripRequest<{ schedule_item_id: number }>(`/planning/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) }),
  reorderSchedule: (id: number, direction: 'up' | 'down') => tripRequest<{ ok: boolean }>(`/schedule/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),
  expenses: () => tripRequest<{ expenses: Expense[]; total_minor: number; legacy_count: number }>('/expenses'),
  create: <T>(resource: string, data: unknown) => tripRequest<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: <T>(resource: string, id: string | number, data: unknown) => tripRequest<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (resource: string, id: string | number) => tripRequest<{ ok: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
  prefetchWorkspace: () => Promise.allSettled([api.dashboard(), api.schedule(), api.planning(), api.expenses()]),
};
