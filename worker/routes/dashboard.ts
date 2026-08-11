import { Hono } from 'hono';
import type { AppEnv } from '../types';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/dashboard', async (c) => {
  const tripId = c.get('tripId');
  const [trip, members, schedule, nextSchedule, activities, planningCount, expenseTotal] = await Promise.all([
    c.env.DB.prepare(`SELECT id,name,destination,country_code,start_date,end_date,timezone,
      COALESCE(currency_code,default_currency) default_currency FROM trips WHERE id=?`).bind(tripId).first(),
    c.env.DB.prepare(`SELECT u.id,u.name,u.email,u.avatar_color,u.avatar_key,tm.role FROM trip_members tm
      JOIN users u ON u.id=tm.user_id WHERE tm.trip_id=? ORDER BY CASE tm.role WHEN 'owner' THEN 0 ELSE 1 END,u.id`).bind(tripId).all(),
    c.env.DB.prepare(`SELECT s.*,d.day_date,d.day_number,p.name place_name FROM schedule_items s
      JOIN trip_days d ON d.id=s.trip_day_id LEFT JOIN places p ON p.id=s.place_id
      WHERE s.trip_id=? ORDER BY d.day_date,COALESCE(s.start_time,'99:99'),s.sort_order LIMIT 6`).bind(tripId).all(),
    c.env.DB.prepare(`SELECT s.*,d.day_date,d.day_number,p.name place_name FROM schedule_items s
      JOIN trip_days d ON d.id=s.trip_day_id LEFT JOIN places p ON p.id=s.place_id
      WHERE s.trip_id=? AND d.day_date>=date('now')
      ORDER BY d.day_date,COALESCE(s.start_time,'99:99'),s.sort_order LIMIT 1`).bind(tripId).first(),
    c.env.DB.prepare(`SELECT a.*,u.name actor_name,u.avatar_color actor_color,u.avatar_key actor_avatar_key FROM activity_logs a
      JOIN users u ON u.id=a.actor_id WHERE a.trip_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 8`).bind(tripId).all(),
    c.env.DB.prepare("SELECT COUNT(*) count FROM planning_items WHERE trip_id=? AND status='inbox'").bind(tripId).first<number>('count'),
    c.env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) total FROM expenses WHERE trip_id=? AND currency='KRW'").bind(tripId).first<number>('total'),
  ]);
  const schedulePreview = schedule.results;
  return c.json({
    trip, members: members.results,
    nextSchedule, schedulePreview, activities: activities.results,
    planningCount: planningCount ?? 0, expenseTotal: expenseTotal ?? 0,
  });
});
