import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

const tripInput = z.object({
  name: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
  country_code: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  start_date: z.string().date(),
  end_date: z.string().date(),
  default_currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(1).max(80),
}).refine((value) => value.end_date >= value.start_date, { message: '종료일은 시작일보다 빠를 수 없습니다.' });

const memberInput = z.object({ user_id: z.number().int().positive() });
export const tripsRoutes = new Hono<AppEnv>();
tripsRoutes.use('*', requireAuth);

tripsRoutes.get('/', async (c) => {
  const trips = await c.env.DB.prepare(
    `SELECT t.id, t.name, t.destination, t.country_code, t.start_date, t.end_date,
            t.timezone, COALESCE(t.currency_code, t.default_currency) AS default_currency, tm.role
     FROM trip_members tm JOIN trips t ON t.id = tm.trip_id
     WHERE tm.user_id = ? ORDER BY t.start_date DESC, t.id DESC`,
  ).bind(c.get('userId')).all();
  return c.json({ trips: trips.results });
});

tripsRoutes.post('/', zValidator('json', tripInput), async (c) => {
  const input = c.req.valid('json');
  const legacyCurrency = input.default_currency === 'PHP' ? 'PHP' : 'KRW';
  const result = await c.env.DB.prepare(
    `INSERT INTO trips(name, destination, country_code, start_date, end_date, timezone, default_currency, currency_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(input.name, input.destination, input.country_code, input.start_date, input.end_date,
    input.timezone, legacyCurrency, input.default_currency).run();
  const tripId = Number(result.meta.last_row_id);
  const days: D1PreparedStatement[] = [
    c.env.DB.prepare("INSERT INTO trip_members(trip_id, user_id, role) VALUES (?, ?, 'owner')").bind(tripId, c.get('userId')),
  ];
  const cursor = new Date(`${input.start_date}T00:00:00Z`);
  const end = new Date(`${input.end_date}T00:00:00Z`);
  let dayNumber = 1;
  while (cursor <= end) {
    days.push(c.env.DB.prepare(
      'INSERT INTO trip_days(trip_id, day_number, day_date) VALUES (?, ?, ?)',
    ).bind(tripId, dayNumber, cursor.toISOString().slice(0, 10)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    dayNumber += 1;
  }
  await c.env.DB.batch(days);
  return c.json({ trip: { id: tripId, ...input, role: 'owner' as const } }, 201);
});

tripsRoutes.get('/:tripId/members', async (c) => {
  const tripId = Number(c.req.param('tripId'));
  const membership = await c.env.DB.prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .bind(tripId, c.get('userId')).first<{ role: string }>();
  if (!membership) return c.json({ error: '여행을 찾을 수 없습니다.' }, 404);
  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.avatar_color, tm.role
     FROM trip_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.trip_id = ? ORDER BY CASE tm.role WHEN 'owner' THEN 0 ELSE 1 END, u.id`,
  ).bind(tripId).all();
  return c.json({ members: members.results, can_manage: membership.role === 'owner' });
});

tripsRoutes.post('/:tripId/members', zValidator('json', memberInput), async (c) => {
  const tripId = Number(c.req.param('tripId'));
  const owner = await c.env.DB.prepare("SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ? AND role = 'owner'")
    .bind(tripId, c.get('userId')).first();
  if (!owner) return c.json({ error: 'Owner만 멤버를 관리할 수 있습니다.' }, 403);
  const { user_id: userId } = c.req.valid('json');
  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ? AND is_active = 1',
  ).bind(userId).first<{ id: number }>();
  if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);
  const existing = await c.env.DB.prepare('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .bind(tripId, user.id).first();
  if (existing) return c.json({ error: '이미 참여 중인 프로필입니다.' }, 409);
  await c.env.DB.prepare("INSERT INTO trip_members(trip_id, user_id, role) VALUES (?, ?, 'member')")
    .bind(tripId, user.id).run();
  return c.json({ ok: true });
});

tripsRoutes.delete('/:tripId/members/:userId', async (c) => {
  const tripId = Number(c.req.param('tripId'));
  const targetUserId = Number(c.req.param('userId'));
  const owner = await c.env.DB.prepare("SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ? AND role = 'owner'")
    .bind(tripId, c.get('userId')).first();
  if (!owner) return c.json({ error: 'Owner만 멤버를 관리할 수 있습니다.' }, 403);
  const target = await c.env.DB.prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .bind(tripId, targetUserId).first<{ role: string }>();
  if (!target) return c.json({ error: '멤버를 찾을 수 없습니다.' }, 404);
  if (target.role === 'owner') return c.json({ error: 'Owner는 제거할 수 없습니다.' }, 400);
  await c.env.DB.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?').bind(tripId, targetUserId).run();
  return c.json({ ok: true });
});

tripsRoutes.delete('/:tripId', async (c) => {
  const tripId = Number(c.req.param('tripId'));
  const owner = await c.env.DB.prepare("SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ? AND role = 'owner'")
    .bind(tripId, c.get('userId')).first();
  if (!owner) return c.json({ error: 'Owner만 여행을 삭제할 수 있습니다.' }, 403);
  await c.env.DB.prepare('DELETE FROM trips WHERE id = ?').bind(tripId).run();
  return c.json({ ok: true });
});
