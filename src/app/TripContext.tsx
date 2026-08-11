import { createContext, useContext, type ReactNode } from 'react';
import type { TripSummary } from '../api';

export type TripContextValue = TripSummary & { updateCurrentTrip: (changes: Partial<TripSummary>) => void };
const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ value, updateCurrentTrip, children }: { value: TripSummary; updateCurrentTrip: (changes: Partial<TripSummary>) => void; children: ReactNode }) {
  return <TripContext.Provider value={{ ...value, updateCurrentTrip }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const trip = useContext(TripContext);
  if (!trip) throw new Error('TripProvider 안에서 사용해 주세요.');
  return trip;
}
