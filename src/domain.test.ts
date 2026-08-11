import { describe, expect, it } from 'vitest';
import { calculateSettlements, currencyMinorDigits, formatMoneyMinor, splitAmountMinor, type Expense } from './domain';

const expense = (paidBy: number, amountMinor: number, shares: [number, number][]): Expense => ({
  id: crypto.randomUUID(), trip_id: 1, title: 'test', amount_minor: amountMinor,
  currency: 'PHP', paid_by: paidBy, payer_name: '', expense_date: '2026-01-01',
  category: '기타', notes: null,
  participants: shares.map(([user_id, share_amount_minor]) => ({ user_id, share_amount_minor, name: '' })),
});

describe('splitAmountMinor', () => {
  it('나머지를 배분해 부담금 합계가 원금과 정확히 일치한다', () => {
    const shares = splitAmountMinor(10_000, [1, 2, 3]);
    expect(shares.map((share) => share.shareAmountMinor)).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((sum, share) => sum + share.shareAmountMinor, 0)).toBe(10_000);
  });

  it('중복 참여자를 거부한다', () => {
    expect(() => splitAmountMinor(100, [1, 1])).toThrow('참여자');
  });
});

describe('calculateSettlements', () => {
  it('정수 잔액을 오차 허용 없이 정산한다', () => {
    expect(calculateSettlements([expense(1, 10_000, [[1, 3334], [2, 3333], [3, 3333]])], 'PHP'))
      .toEqual([
        { from: 2, to: 1, amount_minor: 3333, currency: 'PHP' },
        { from: 3, to: 1, amount_minor: 3333, currency: 'PHP' },
      ]);
  });
});

describe('currency formatting', () => {
  it('uses ISO currency minor digits', () => {
    expect(currencyMinorDigits('KRW')).toBe(0);
    expect(currencyMinorDigits('USD')).toBe(2);
    expect(formatMoneyMinor(1234, 'USD', 'en-US')).toBe('$12.34');
  });
});
