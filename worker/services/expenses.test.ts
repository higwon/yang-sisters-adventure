import { describe, expect, it } from 'vitest';
import { splitAmountMinor } from './expenses';

describe('worker splitAmountMinor', () => {
  it('100 PHP를 세 명에게 33.34, 33.33, 33.33으로 나눈다', () => {
    expect(splitAmountMinor(10_000, [1, 2, 3])).toEqual([
      { userId: 1, shareAmountMinor: 3334 },
      { userId: 2, shareAmountMinor: 3333 },
      { userId: 3, shareAmountMinor: 3333 },
    ]);
  });
});
