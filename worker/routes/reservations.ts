import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const reservationRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1), type: z.string().trim().min(1),
  reservation_date: z.string().date().nullable().optional(),
  confirmation_number: z.string().nullable().optional(), link: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

reservationRoutes.get('/reservations', async (c) => c.json((await c.env.DB.prepare(
  'SELECT * FROM reservations WHERE trip_id=? ORDER BY reservation_date',
).bind(c.get('tripId')).all()).results));

reservationRoutes.post('/reservations', zValidator('json', schema), async (c) => {
  const x = c.req.valid('json');
  return c.json(await c.env.DB.prepare(
    `INSERT INTO reservations(trip_id,title,type,reservation_date,confirmation_number,link,notes)
     VALUES(?,?,?,?,?,?,?) RETURNING *`,
  ).bind(c.get('tripId'), x.title, x.type, x.reservation_date ?? null,
    x.confirmation_number ?? null, x.link ?? null, x.notes ?? null).first(), 201);
});

reservationRoutes.patch('/reservations/:id', zValidator('json', schema.partial()), async (c) => {
  const current = await c.env.DB.prepare('SELECT * FROM reservations WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '예약 정보를 찾을 수 없습니다.' }, 404);
  const x = { ...current, ...c.req.valid('json') };
  return c.json(await c.env.DB.prepare(
    `UPDATE reservations SET title=?,type=?,reservation_date=?,confirmation_number=?,link=?,notes=?
     WHERE id=? AND trip_id=? RETURNING *`,
  ).bind(x.title, x.type, x.reservation_date ?? null, x.confirmation_number ?? null,
    x.link ?? null, x.notes ?? null, c.req.param('id'), c.get('tripId')).first());
});

reservationRoutes.delete('/reservations/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM reservations WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
