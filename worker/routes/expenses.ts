import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertTripMembers, splitAmountMinor } from '../services/expenses';
import type { AppEnv } from '../types';

export const expenseRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1), amount_minor: z.number().int().positive(),
  currency: z.enum(['KRW', 'PHP']), paid_by: z.number().int().positive(),
  expense_date: z.string().date(), category: z.string().trim().min(1),
  notes: z.string().nullable().optional(), participant_ids: z.array(z.number().int().positive()).min(1),
});

expenseRoutes.get('/expenses', async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT e.*,u.name payer_name FROM expenses e JOIN users u ON u.id=e.paid_by
     WHERE e.trip_id=? ORDER BY e.expense_date DESC`,
  ).bind(c.get('tripId')).all()).results as Record<string, unknown>[];
  for (const expense of rows) {
    expense.participants = (await c.env.DB.prepare(
      `SELECT ep.user_id,u.name,ep.share_amount_minor FROM expense_participants ep
       JOIN users u ON u.id=ep.user_id WHERE ep.expense_id=? ORDER BY ep.user_id`,
    ).bind(expense.id).all()).results;
  }
  return c.json(rows);
});

expenseRoutes.post('/expenses', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId'); const x = c.req.valid('json');
  await assertTripMembers(c.env.DB, tripId, [x.paid_by, ...x.participant_ids]);
  const shares = splitAmountMinor(x.amount_minor, x.participant_ids);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO expenses(id,trip_id,title,amount_minor,currency,paid_by,expense_date,category,notes)
       VALUES(?,?,?,?,?,?,?,?,?)`,
    ).bind(id, tripId, x.title, x.amount_minor, x.currency, x.paid_by,
      x.expense_date, x.category, x.notes ?? null),
    ...shares.map((share) => c.env.DB.prepare(
      'INSERT INTO expense_participants(expense_id,user_id,share_amount_minor) VALUES(?,?,?)',
    ).bind(id, share.userId, share.shareAmountMinor)),
  ]);
  return c.json({ id }, 201);
});

expenseRoutes.delete('/expenses/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM expenses WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
