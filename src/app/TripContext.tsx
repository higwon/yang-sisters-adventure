import { createContext, useContext } from 'react';
import type { TripSummary } from '../api';

const TripContext = createContext<TripSummary | null>(null);

export const TripProvider = TripContext.Provider;

export function useTrip() {
  const trip = useContext(TripContext);
  if (!trip) throw new Error('TripProvider 안에서 사용해 주세요.');
  return trip;
}
