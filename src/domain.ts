export type Currency = 'KRW' | 'PHP';
export interface User { id: number; name: string; email: string; avatar_color: string }
export interface Trip { id: number; name: string; destination: string; country_code: string; start_date: string; end_date: string; timezone: string }
export interface Member extends User { role: 'owner' | 'member' }
export interface Place { id: number; trip_id: number; name: string; category: string; address: string | null; map_url: string | null; website_url: string | null; notes: string | null; is_must_visit: number }
export interface ScheduleParticipant { id: number; name: string; avatar_color: string }
export interface ScheduleItem { id: number; trip_id: number; trip_day_id: number; day_date: string; day_number: number; title: string; start_time: string | null; end_time: string | null; category: string; notes: string | null; url: string | null; sort_order: number; place_id: number | null; place_name: string | null; status: 'confirmed' | 'candidate'; participants: ScheduleParticipant[] }
export interface PlanningItem { id: number; trip_id: number; title: string; item_type: string; place_id: number | null; place_name: string | null; url: string | null; notes: string | null; created_by: number; created_by_name: string; status: 'inbox' | 'scheduled'; schedule_item_id: number | null; created_at: string }
export interface ChecklistItem { id: number; trip_id: number; title: string; is_completed: number; assignee_id: number | null; assignee_name: string | null; due_date: string | null; category: string; notes: string | null }
export interface Reservation { id: number; trip_id: number; title: string; type: string; reservation_date: string | null; confirmation_number: string | null; link: string | null; notes: string | null }
export interface ExpenseParticipant { user_id: number; name: string; share_amount_minor: number }
export interface Expense { id: string; trip_id: number; title: string; amount_minor: number; currency: Currency; paid_by: number; payer_name: string; expense_date: string; category: string; notes: string | null; participants: ExpenseParticipant[] }
export interface Activity { id: number; actor_id: number; actor_name: string; actor_color: string; action: 'create' | 'update' | 'delete'; entity_type: string; entity_id: string | null; summary: string; created_at: string }
export interface Dashboard { trip: Trip; members: Member[]; checklist: { completed: number; total: number }; nextSchedule: ScheduleItem | null; schedulePreview: ScheduleItem[]; activities: Activity[]; planningCount: number; expenseTotals: { currency: string; amount_minor: number }[] }
export interface Settlement { from: number; to: number; amount_minor: number; currency: Currency }

export function currencyMinorDigits(currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 0;
}

export function formatMoneyMinor(amountMinor: number, currency: string, locale = 'ko-KR') {
  const digits = currencyMinorDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 10 ** digits);
}

export function splitAmountMinor(amountMinor: number, participantIds: number[]) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('금액이 올바르지 않습니다.');
  const uniqueIds = [...new Set(participantIds)];
  if (!uniqueIds.length || uniqueIds.length !== participantIds.length) throw new Error('참여자를 확인해 주세요.');
  const base = Math.floor(amountMinor / uniqueIds.length);
  const remainder = amountMinor % uniqueIds.length;
  return uniqueIds.map((userId, index) => ({ userId, shareAmountMinor: base + (index < remainder ? 1 : 0) }));
}

export function calculateSettlements(expenses: Expense[], currency: Currency): Settlement[] {
  const balances = new Map<number, number>();
  for (const expense of expenses.filter((item) => item.currency === currency)) {
    balances.set(expense.paid_by, (balances.get(expense.paid_by) ?? 0) + expense.amount_minor);
    for (const participant of expense.participants) {
      balances.set(participant.user_id, (balances.get(participant.user_id) ?? 0) - participant.share_amount_minor);
    }
  }
  const debtors = [...balances].filter(([, value]) => value < 0).map(([id, value]) => ({ id, amount: -value }));
  const creditors = [...balances].filter(([, value]) => value > 0).map(([id, amount]) => ({ id, amount }));
  const result: Settlement[] = [];
  let debtorIndex = 0; let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    result.push({ from: debtors[debtorIndex].id, to: creditors[creditorIndex].id, amount_minor: amount, currency });
    debtors[debtorIndex].amount -= amount; creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }
  return result;
}
