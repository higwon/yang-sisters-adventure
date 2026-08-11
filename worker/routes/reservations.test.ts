import { describe, expect, it } from 'vitest';
import { validReservationPeriod } from './reservations';

describe('reservation period', () => {
  it('allows an absent boundary or an ordered period', () => {
    expect(validReservationPeriod({ start_at: '2026-08-20T15:00' })).toBe(true);
    expect(validReservationPeriod({ start_at: '2026-08-20T15:00', end_at: '2026-08-20T16:00' })).toBe(true);
  });

  it('rejects an end before the start', () => {
    expect(validReservationPeriod({ start_at: '2026-08-20T15:00', end_at: '2026-08-19T11:00' })).toBe(false);
  });
});
