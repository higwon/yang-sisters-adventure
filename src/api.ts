import type { ChecklistItem, Dashboard, Expense, Place, Reservation, ScheduleItem } from './domain';

const TRIP_ID = 1;
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: '요청에 실패했습니다.' })) as { error?: string };
    throw new Error(body.error ?? '요청에 실패했습니다.');
  }
  return response.json() as Promise<T>;
};

export interface AuthUser { id: number; name: string; email: string; avatar_color: string }
export interface SelectableProfile { id: 1 | 2 | 3; name: string; avatar_color: string }
const tripRequest = <T>(path: string, init?: RequestInit) => request<T>(`/api/trips/${TRIP_ID}${path}`, init);
const authRequest = <T>(path: string, init?: RequestInit) => request<T>(`/api/auth${path}`, init);

export const api = {
  me: () => authRequest<{ user: AuthUser }>('/me'),
  profiles: () => authRequest<{ profiles: SelectableProfile[] }>('/profiles'),
  selectProfile: (user_id: 1 | 2 | 3) => authRequest<{ user: AuthUser }>('/profile', { method: 'POST', body: JSON.stringify({ user_id }) }),
  logout: () => authRequest<{ ok: boolean }>('/logout', { method: 'POST' }),
  dashboard: () => tripRequest<Dashboard>('/dashboard'),
  schedule: () => tripRequest<ScheduleItem[]>('/schedule'),
  places: () => tripRequest<Place[]>('/places'),
  checklist: () => tripRequest<ChecklistItem[]>('/checklist'),
  expenses: () => tripRequest<Expense[]>('/expenses'),
  reservations: () => tripRequest<Reservation[]>('/reservations'),
  create: <T>(resource: string, data: unknown) => tripRequest<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: <T>(resource: string, id: string | number, data: unknown) => tripRequest<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (resource: string, id: string | number) => tripRequest<{ ok: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
};
