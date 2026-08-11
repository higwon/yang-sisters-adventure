import { useEffect, useState } from 'react';

export type WorkspacePage = 'home' | 'schedule' | 'map' | 'board' | 'expenses' | 'info' | 'checklist' | 'more';

const pages = new Set<WorkspacePage>(['home', 'schedule', 'map', 'board', 'expenses', 'info', 'checklist', 'more']);

export function readWorkspacePath() {
  const match = window.location.pathname.match(/^\/trips\/(\d+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  const candidate = match[2] as WorkspacePage | undefined;
  return { tripId: Number(match[1]), page: candidate && pages.has(candidate) ? candidate : 'home' as WorkspacePage };
}

export function navigateToTrip(tripId: number, page: WorkspacePage = 'home', replace = false) {
  const url = `/trips/${tripId}/${page}`;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToTrips(replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useWorkspacePage() {
  const [page, setPage] = useState<WorkspacePage>(() => readWorkspacePath()?.page ?? 'home');
  useEffect(() => {
    const sync = () => setPage(readWorkspacePath()?.page ?? 'home');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return page;
}
