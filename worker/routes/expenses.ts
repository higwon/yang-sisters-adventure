import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertTripMembers } from '../services/expenses';
import type { AppEnv } from '../types';

export const expenseRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1),
  amount_minor: z.number().int().positive(),
  paid_by: z.number().int().positive(),
  expense_date: z.string().date(),
  category: z.enum(['항공', '숙소', '교통', '식사', '투어', '쇼핑', '기타']),
  notes: z.string().trim().nullable().optional(),
});

expenseRoutes.get('/expenses', async (c) => {
  const tripId = c.get('tripId');
  const [rows, totals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT e.id,e.trip_id,e.title,e.amount_minor,e.paid_by,e.expense_date,e.category,e.notes,u.name payer_name
       FROM expenses e JOIN users u ON u.id=e.paid_by
       WHERE e.trip_id=? AND e.currency='KRW' ORDER BY e.expense_date DESC,e.id DESC`,
    ).bind(tripId).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN currency='KRW' THEN amount_minor ELSE 0 END),0) total_minor,
        COALESCE(SUM(CASE WHEN currency<>'KRW' THEN 1 ELSE 0 END),0) legacy_count
       FROM expenses WHERE trip_id=?`,
    ).bind(tripId).first<{ total_minor: number; legacy_count: number }>(),
  ]);
  return c.json({ expenses: rows.results, total_minor: Number(totals?.total_minor ?? 0), legacy_count: Number(totals?.legacy_count ?? 0) });
});

expenseRoutes.post('/expenses', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId'); const x = c.req.valid('json');
  await assertTripMembers(c.env.DB, tripId, [x.paid_by]);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO expenses(id,trip_id,title,amount_minor,currency,paid_by,expense_date,category,notes)
     VALUES(?,?,?,?,?,?,?,?,?)`,
  ).bind(id, tripId, x.title, x.amount_minor, 'KRW', x.paid_by, x.expense_date, x.category, x.notes ?? null).run();
  return c.json({ id }, 201);
});

expenseRoutes.patch('/expenses/:id', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId'); const x = c.req.valid('json');
  await assertTripMembers(c.env.DB, tripId, [x.paid_by]);
  const result = await c.env.DB.prepare(
    `UPDATE expenses SET title=?,amount_minor=?,paid_by=?,expense_date=?,category=?,notes=?
     WHERE id=? AND trip_id=? AND currency='KRW'`,
  ).bind(x.title, x.amount_minor, x.paid_by, x.expense_date, x.category, x.notes ?? null, c.req.param('id'), tripId).run();
  if (!result.meta.changes) return c.json({ error: '비용을 찾을 수 없습니다.' }, 404);
  return c.json({ ok: true });
});

expenseRoutes.delete('/expenses/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM expenses WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
