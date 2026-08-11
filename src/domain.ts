export interface User { id: number; name: string; email: string; avatar_color: string; avatar_key: string | null }
export interface Trip { id: number; name: string; destination: string; country_code: string; start_date: string; end_date: string; timezone: string }
export interface Member extends User { role: 'owner' | 'member' }
export interface ScheduleParticipant { id: number; name: string; avatar_color: string }
export interface ScheduleItem { id: number; trip_id: number; trip_day_id: number; day_date: string; day_number: number; title: string; start_time: string | null; end_time: string | null; end_next_day: number; category: string; notes: string | null; url: string | null; sort_order: number; place_id: number | null; place_name: string | null; status: 'confirmed' | 'candidate'; participants: ScheduleParticipant[] }
export interface PlanningItem { id: number; trip_id: number; title: string; item_type: string; place_id: number | null; place_name: string | null; url: string | null; notes: string | null; created_by: number; created_by_name: string; status: 'inbox' | 'scheduled'; schedule_item_id: number | null; created_at: string }
export interface Expense { id: string; trip_id: number; title: string; amount_minor: number; paid_by: number; payer_name: string; expense_date: string; category: string; notes: string | null }
export interface Activity { id: number; actor_id: number; actor_name: string; actor_color: string; actor_avatar_key: string | null; action: 'create' | 'update' | 'delete'; entity_type: string; entity_id: string | null; summary: string; created_at: string }
export interface Dashboard { trip: Trip; members: Member[]; nextSchedule: ScheduleItem | null; schedulePreview: ScheduleItem[]; activities: Activity[]; planningCount: number; expenseTotal: number }

export const formatKrw = (amount: number) => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
}).format(amount);
