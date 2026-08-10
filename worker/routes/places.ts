import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const placeRoutes = new Hono<AppEnv>();
const schema = z.object({
  name: z.string().trim().min(1), category: z.string().trim().min(1),
  address: z.string().nullable().optional(), map_url: z.string().url().nullable().optional(),
  website_url: z.string().url().nullable().optional(), notes: z.string().nullable().optional(),
  is_must_visit: z.number().int().min(0).max(1).default(0),
});

placeRoutes.get('/places', async (c) => c.json((await c.env.DB.prepare(
  'SELECT * FROM places WHERE trip_id = ? ORDER BY is_must_visit DESC, name',
).bind(c.get('tripId')).all()).results));

placeRoutes.post('/places', zValidator('json', schema), async (c) => {
  const x = c.req.valid('json');
  return c.json(await c.env.DB.prepare(
    `INSERT INTO places(trip_id,name,category,address,map_url,website_url,notes,is_must_visit)
     VALUES(?,?,?,?,?,?,?,?) RETURNING *`,
  ).bind(c.get('tripId'), x.name, x.category, x.address ?? null, x.map_url ?? null,
    x.website_url ?? null, x.notes ?? null, x.is_must_visit).first(), 201);
});

placeRoutes.patch('/places/:id', zValidator('json', schema.partial()), async (c) => {
  const current = await c.env.DB.prepare('SELECT * FROM places WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '장소를 찾을 수 없습니다.' }, 404);
  const x = { ...current, ...c.req.valid('json') };
  return c.json(await c.env.DB.prepare(
    `UPDATE places SET name=?,category=?,address=?,map_url=?,website_url=?,notes=?,is_must_visit=?
     WHERE id=? AND trip_id=? RETURNING *`,
  ).bind(x.name, x.category, x.address ?? null, x.map_url ?? null, x.website_url ?? null,
    x.notes ?? null, x.is_must_visit, c.req.param('id'), c.get('tripId')).first());
});

placeRoutes.delete('/places/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM places WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
