export interface User { id: number; name: string; email: string; avatar_color: string }
export interface Trip { id: number; name: string; destination: string; country_code: string; start_date: string; end_date: string; timezone: string }
export interface Member extends User { role: 'owner' | 'member' }
export interface Place { id: number; trip_id: number; name: string; category: string; address: string | null; map_url: string | null; website_url: string | null; photo_url: string | null; latitude: number | null; longitude: number | null; notes: string | null; is_must_visit: number }
export interface ScheduleParticipant { id: number; name: string; avatar_color: string }
export interface ScheduleItem { id: number; trip_id: number; trip_day_id: number; day_date: string; day_number: number; title: string; start_time: string | null; end_time: string | null; category: string; notes: string | null; url: string | null; sort_order: number; place_id: number | null; place_name: string | null; status: 'confirmed' | 'candidate'; participants: ScheduleParticipant[] }
export interface PlanningItem { id: number; trip_id: number; title: string; item_type: string; place_id: number | null; place_name: string | null; url: string | null; notes: string | null; created_by: number; created_by_name: string; status: 'inbox' | 'scheduled'; schedule_item_id: number | null; created_at: string }
export interface ChecklistItem { id: number; trip_id: number; title: string; is_completed: number; assignee_id: number | null; assignee_name: string | null; due_date: string | null; category: string; notes: string | null }
export interface ReservationAttachment { id: number; file_name: string; content_type: string; byte_size: number }
export interface Reservation { id: number; trip_id: number; title: string; type: string; reservation_date: string | null; start_at: string | null; end_at: string | null; confirmation_number: string | null; link: string | null; notes: string | null; attachments: ReservationAttachment[] }
export interface Expense { id: string; trip_id: number; title: string; amount_minor: number; paid_by: number; payer_name: string; expense_date: string; category: string; notes: string | null }
export interface Activity { id: number; actor_id: number; actor_name: string; actor_color: string; action: 'create' | 'update' | 'delete'; entity_type: string; entity_id: string | null; summary: string; created_at: string }
export interface Dashboard { trip: Trip; members: Member[]; checklist: { completed: number; total: number }; nextSchedule: ScheduleItem | null; schedulePreview: ScheduleItem[]; activities: Activity[]; planningCount: number; expenseTotal: number }

export const formatKrw = (amount: number) => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
}).format(amount);
