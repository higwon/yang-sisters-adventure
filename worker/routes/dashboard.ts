import { Hono } from 'hono';
import type { AppEnv } from '../types';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/dashboard', async (c) => {
  const tripId = c.get('tripId');
  const [trip, members, checklist, nextSchedule, recentUpdates] = await Promise.all([
    c.env.DB.prepare(`SELECT id, name, destination, country_code, start_date, end_date, timezone,
      COALESCE(currency_code, default_currency) AS default_currency FROM trips WHERE id = ?`).bind(tripId).first(),
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.avatar_color, tm.role
       FROM trip_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = ? ORDER BY u.id`,
    ).bind(tripId).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) total, SUM(is_completed) completed FROM checklist_items WHERE trip_id = ?',
    ).bind(tripId).first(),
    c.env.DB.prepare(
      `SELECT s.*, d.day_date, d.day_number, p.name place_name
       FROM schedule_items s
       JOIN trip_days d ON d.id = s.trip_day_id
       LEFT JOIN places p ON p.id = s.place_id
       WHERE s.trip_id = ? AND d.day_date >= date('now')
       ORDER BY d.day_date, s.start_time LIMIT 1`,
    ).bind(tripId).first(),
    c.env.DB.prepare(
      'SELECT content text, created_at at FROM notes WHERE trip_id = ? ORDER BY created_at DESC LIMIT 3',
    ).bind(tripId).all(),
  ]);

  return c.json({
    trip,
    members: members.results,
    checklist: {
      completed: Number(checklist?.completed ?? 0),
      total: Number(checklist?.total ?? 0),
    },
    nextSchedule,
    recentUpdates: recentUpdates.results,
  });
});
