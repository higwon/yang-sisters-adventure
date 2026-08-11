import { useEffect, useState } from 'react';

export type WorkspacePage = 'home' | 'schedule' | 'board' | 'expenses' | 'settings';
const pages = new Set<WorkspacePage>(['home', 'schedule', 'board', 'expenses', 'settings']);
const boardRedirects = new Set(['map', 'places', 'info', 'reservations']);
const settingsRedirects = new Set(['more', 'tools', 'checklist', 'members']);

export function readWorkspacePath() {
  const match = window.location.pathname.match(/^\/trips\/(\d+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  let candidate = match[2] as WorkspacePage | undefined;
  if (match[2] && boardRedirects.has(match[2])) candidate = 'board';
  if (match[2] && settingsRedirects.has(match[2])) candidate = 'settings';
  const page = candidate && pages.has(candidate) ? candidate : 'home';
  if (match[2] !== page) window.history.replaceState({}, '', `/trips/${match[1]}/${page}`);
  return { tripId: Number(match[1]), page };
}

export function navigateToTrip(tripId: number, page: WorkspacePage = 'home', replace = false) { window.history[replace ? 'replaceState' : 'pushState']({}, '', `/trips/${tripId}/${page}`); window.dispatchEvent(new PopStateEvent('popstate')); }
export function navigateToTrips(replace = false) { window.history[replace ? 'replaceState' : 'pushState']({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }
export function useWorkspacePage() { const [page, setPage] = useState<WorkspacePage>(() => readWorkspacePath()?.page ?? 'home'); useEffect(() => { const sync = () => setPage(readWorkspacePath()?.page ?? 'home'); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []); return page; }
