import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const scheduleRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1),
  day_date: z.string().date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  place_id: z.number().int().positive().nullable().optional(),
  category: z.string().trim().min(1),
  notes: z.string().nullable().optional(),
  status: z.enum(['confirmed', 'candidate']).default('confirmed'),
});

scheduleRoutes.get('/schedule', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT s.*, d.day_date, d.day_number, p.name place_name
     FROM schedule_items s JOIN trip_days d ON d.id = s.trip_day_id
     LEFT JOIN places p ON p.id = s.place_id
     WHERE s.trip_id = ? ORDER BY d.day_date, s.start_time`,
  ).bind(c.get('tripId')).all();
  return c.json(result.results);
});

scheduleRoutes.post('/schedule', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId');
  const data = c.req.valid('json');
  const day = await c.env.DB.prepare(
    'SELECT id FROM trip_days WHERE trip_id = ? AND day_date = ?',
  ).bind(tripId, data.day_date).first<{ id: number }>();
  if (!day) return c.json({ error: '여행 기간에 포함된 날짜를 선택해 주세요.' }, 400);
  if (data.place_id) {
    const place = await c.env.DB.prepare(
      'SELECT 1 FROM places WHERE id = ? AND trip_id = ?',
    ).bind(data.place_id, tripId).first();
    if (!place) return c.json({ error: '현재 여행의 장소만 선택할 수 있습니다.' }, 400);
  }
  const row = await c.env.DB.prepare(
    `INSERT INTO schedule_items
     (trip_id, trip_day_id, place_id, title, start_time, end_time, category, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  ).bind(tripId, day.id, data.place_id ?? null, data.title, data.start_time ?? null,
    data.end_time ?? null, data.category, data.notes ?? null, data.status).first();
  return c.json(row, 201);
});

scheduleRoutes.patch('/schedule/:id', zValidator('json', schema.partial()), async (c) => {
  const tripId = c.get('tripId');
  const current = await c.env.DB.prepare(
    `SELECT s.*, d.day_date FROM schedule_items s JOIN trip_days d ON d.id = s.trip_day_id
     WHERE s.id = ? AND s.trip_id = ?`,
  ).bind(c.req.param('id'), tripId).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
  const data = c.req.valid('json');
  const date = data.day_date ?? String(current.day_date);
  const day = await c.env.DB.prepare(
    'SELECT id FROM trip_days WHERE trip_id = ? AND day_date = ?',
  ).bind(tripId, date).first<{ id: number }>();
  if (!day) return c.json({ error: '여행 기간에 포함된 날짜를 선택해 주세요.' }, 400);
  const merged = { ...current, ...data };
  const row = await c.env.DB.prepare(
    `UPDATE schedule_items SET trip_day_id=?, place_id=?, title=?, start_time=?, end_time=?,
     category=?, notes=?, status=? WHERE id=? AND trip_id=? RETURNING *`,
  ).bind(day.id, merged.place_id ?? null, merged.title, merged.start_time ?? null,
    merged.end_time ?? null, merged.category, merged.notes ?? null, merged.status,
    c.req.param('id'), tripId).first();
  return c.json(row);
});

scheduleRoutes.delete('/schedule/:id', async (c) => {
  const result = await c.env.DB.prepare(
    'DELETE FROM schedule_items WHERE id = ? AND trip_id = ?',
  ).bind(c.req.param('id'), c.get('tripId')).run();
  return c.json({ ok: result.meta.changes > 0 });
});
