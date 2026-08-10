import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const checklistRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1), category: z.string().trim().min(1),
  assignee_id: z.number().int().positive().nullable().optional(),
  due_date: z.string().date().nullable().optional(), notes: z.string().nullable().optional(),
  is_completed: z.number().int().min(0).max(1).default(0),
});

async function validAssignee(db: D1Database, tripId: number, userId?: number | null) {
  if (!userId) return true;
  return Boolean(await db.prepare('SELECT 1 FROM trip_members WHERE trip_id=? AND user_id=?')
    .bind(tripId, userId).first());
}

checklistRoutes.get('/checklist', async (c) => c.json((await c.env.DB.prepare(
  `SELECT i.*,u.name assignee_name FROM checklist_items i LEFT JOIN users u ON u.id=i.assignee_id
   WHERE i.trip_id=? ORDER BY i.is_completed,i.due_date`,
).bind(c.get('tripId')).all()).results));

checklistRoutes.post('/checklist', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId'); const x = c.req.valid('json');
  if (!(await validAssignee(c.env.DB, tripId, x.assignee_id)))
    return c.json({ error: '담당자는 현재 여행 멤버여야 합니다.' }, 400);
  return c.json(await c.env.DB.prepare(
    `INSERT INTO checklist_items(trip_id,title,category,assignee_id,due_date,notes,is_completed)
     VALUES(?,?,?,?,?,?,?) RETURNING *`,
  ).bind(tripId, x.title, x.category, x.assignee_id ?? null, x.due_date ?? null,
    x.notes ?? null, x.is_completed).first(), 201);
});

checklistRoutes.patch('/checklist/:id', zValidator('json', schema.partial()), async (c) => {
  const tripId = c.get('tripId'); const data = c.req.valid('json');
  const current = await c.env.DB.prepare('SELECT * FROM checklist_items WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), tripId).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '준비 항목을 찾을 수 없습니다.' }, 404);
  const x = { ...current, ...data };
  if (!(await validAssignee(c.env.DB, tripId, x.assignee_id as number | null)))
    return c.json({ error: '담당자는 현재 여행 멤버여야 합니다.' }, 400);
  return c.json(await c.env.DB.prepare(
    `UPDATE checklist_items SET title=?,category=?,assignee_id=?,due_date=?,notes=?,is_completed=?
     WHERE id=? AND trip_id=? RETURNING *`,
  ).bind(x.title, x.category, x.assignee_id ?? null, x.due_date ?? null, x.notes ?? null,
    x.is_completed, c.req.param('id'), tripId).first());
});

checklistRoutes.delete('/checklist/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM checklist_items WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
