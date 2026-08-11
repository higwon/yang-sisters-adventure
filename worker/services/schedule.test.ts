import { describe, expect, it } from 'vitest';
import { validateScheduleParticipants } from './schedule';

describe('validateScheduleParticipants', () => {
  it('accepts current trip members', () => expect(validateScheduleParticipants([1, 2, 3], [1, 3])).toEqual([1, 3]));
  it('rejects users outside the trip', () => expect(() => validateScheduleParticipants([1, 2], [1, 3])).toThrow('현재 여행의 멤버'));
  it('rejects duplicates', () => expect(() => validateScheduleParticipants([1, 2], [1, 1])).toThrow('중복'));
});
