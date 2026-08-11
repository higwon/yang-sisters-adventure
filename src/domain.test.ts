import { describe, expect, it } from 'vitest';
import { formatKrw } from './domain';

describe('formatKrw', () => {
  it('원 단위 정수 금액을 표시한다', () => {
    expect(formatKrw(2_847_500)).toContain('2,847,500');
  });
});
