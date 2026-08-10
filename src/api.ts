import type { ChecklistItem, Dashboard, Expense, Place, Reservation, ScheduleItem } from './domain';

const TRIP_ID = 1;
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/trips/${TRIP_ID}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: '요청에 실패했습니다.' })) as { error?: string };
    throw new Error(body.error ?? '요청에 실패했습니다.');
  }
  return response.json() as Promise<T>;
};

export const api = {
  dashboard: () => request<Dashboard>('/dashboard'),
  schedule: () => request<ScheduleItem[]>('/schedule'),
  places: () => request<Place[]>('/places'),
  checklist: () => request<ChecklistItem[]>('/checklist'),
  expenses: () => request<Expense[]>('/expenses'),
  reservations: () => request<Reservation[]>('/reservations'),
  create: <T>(resource: string, data: unknown) => request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: <T>(resource: string, id: string | number, data: unknown) => request<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (resource: string, id: string | number) => request<{ ok: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
};
