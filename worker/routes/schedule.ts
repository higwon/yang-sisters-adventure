import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateScheduleParticipants } from '../services/schedule';
import type { AppEnv } from '../types';

export const scheduleRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1), day_date: z.string().date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  place_id: z.number().int().positive().nullable().optional(), category: z.string().trim().min(1),
  notes: z.string().trim().nullable().optional(), url: z.string().url().nullable().optional(),
  status: z.enum(['confirmed', 'candidate']).default('confirmed'),
  participant_ids: z.array(z.number().int().positive()).default([]), sort_order: z.number().int().min(0).optional(),
});
type Row = Record<string, unknown> & { id: number };

async function references(db: D1Database, tripId: number, date: string, placeId: number | null | undefined, participantIds: number[]) {
  const day = await db.prepare('SELECT id FROM trip_days WHERE trip_id=? AND day_date=?').bind(tripId, date).first<{ id: number }>();
  if (!day) throw new Error('여행 기간에 포함된 날짜를 선택해 주세요.');
  if (placeId && !await db.prepare('SELECT 1 FROM places WHERE id=? AND trip_id=?').bind(placeId, tripId).first()) throw new Error('현재 여행의 장소만 선택할 수 있습니다.');
  const members = await db.prepare('SELECT user_id FROM trip_members WHERE trip_id=?').bind(tripId).all<{ user_id: number }>();
  return { dayId: day.id, participantIds: validateScheduleParticipants(members.results.map((row) => row.user_id), participantIds) };
}

async function withParticipants(db: D1Database, rows: Row[]) {
  if (!rows.length) return [];
  const people = await db.prepare(`SELECT sp.schedule_item_id,u.id,u.name,u.avatar_color FROM schedule_participants sp JOIN users u ON u.id=sp.user_id WHERE sp.schedule_item_id IN (${rows.map(() => '?').join(',')}) ORDER BY u.name`).bind(...rows.map((row) => row.id)).all<{ schedule_item_id: number; id: number; name: string; avatar_color: string }>();
  return rows.map((row) => ({ ...row, participants: people.results.filter((p) => p.schedule_item_id === row.id).map((person) => ({ id: person.id, name: person.name, avatar_color: person.avatar_color })) }));
}

scheduleRoutes.get('/schedule', async (c) => {
  const result = await c.env.DB.prepare(`SELECT s.*,d.day_date,d.day_number,p.name place_name FROM schedule_items s JOIN trip_days d ON d.id=s.trip_day_id LEFT JOIN places p ON p.id=s.place_id WHERE s.trip_id=? ORDER BY d.day_date,COALESCE(s.start_time,'99:99'),s.sort_order,s.created_at`).bind(c.get('tripId')).all<Row>();
  return c.json(await withParticipants(c.env.DB, result.results));
});

scheduleRoutes.post('/schedule', zValidator('json', schema), async (c) => {
  const tripId = c.get('tripId'); const data = c.req.valid('json');
  try {
    const refs = await references(c.env.DB, tripId, data.day_date, data.place_id, data.participant_ids);
    const order = data.sort_order ?? await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM schedule_items WHERE trip_day_id=?').bind(refs.dayId).first<number>('value') ?? 0;
    const row = await c.env.DB.prepare(`INSERT INTO schedule_items(trip_id,trip_day_id,place_id,title,start_time,end_time,category,notes,status,url,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(tripId, refs.dayId, data.place_id ?? null, data.title, data.start_time ?? null, data.end_time ?? null, data.category, data.notes ?? null, data.status, data.url ?? null, order).first<Row>();
    if (!row) throw new Error('일정을 저장하지 못했습니다.');
    if (refs.participantIds.length) await c.env.DB.batch(refs.participantIds.map((userId) => c.env.DB.prepare('INSERT INTO schedule_participants(schedule_item_id,user_id) VALUES(?,?)').bind(row.id, userId)));
    return c.json((await withParticipants(c.env.DB, [row]))[0], 201);
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : '일정을 저장하지 못했습니다.' }, 400); }
});

scheduleRoutes.patch('/schedule/:id', zValidator('json', schema.partial()), async (c) => {
  const tripId = c.get('tripId'); const id = Number(c.req.param('id'));
  const current = await c.env.DB.prepare(`SELECT s.*,d.day_date FROM schedule_items s JOIN trip_days d ON d.id=s.trip_day_id WHERE s.id=? AND s.trip_id=?`).bind(id, tripId).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
  const data = c.req.valid('json'); const merged = { ...current, ...data };
  try {
    const existingPeople = data.participant_ids === undefined ? await c.env.DB.prepare('SELECT user_id FROM schedule_participants WHERE schedule_item_id=?').bind(id).all<{ user_id: number }>() : null;
    const participantIds = data.participant_ids ?? existingPeople?.results.map((row) => row.user_id) ?? [];
    const refs = await references(c.env.DB, tripId, String(merged.day_date), merged.place_id as number | null, participantIds);
    const row = await c.env.DB.prepare(`UPDATE schedule_items SET trip_day_id=?,place_id=?,title=?,start_time=?,end_time=?,category=?,notes=?,status=?,url=?,sort_order=? WHERE id=? AND trip_id=? RETURNING *`).bind(refs.dayId, merged.place_id ?? null, merged.title, merged.start_time ?? null, merged.end_time ?? null, merged.category, merged.notes ?? null, merged.status, merged.url ?? null, merged.sort_order ?? 0, id, tripId).first<Row>();
    if (!row) return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
    if (data.participant_ids !== undefined) await c.env.DB.batch([c.env.DB.prepare('DELETE FROM schedule_participants WHERE schedule_item_id=?').bind(id), ...refs.participantIds.map((userId) => c.env.DB.prepare('INSERT INTO schedule_participants(schedule_item_id,user_id) VALUES(?,?)').bind(id, userId))]);
    return c.json((await withParticipants(c.env.DB, [row]))[0]);
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : '일정을 수정하지 못했습니다.' }, 400); }
});

scheduleRoutes.delete('/schedule/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM schedule_items WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).run();
  return c.json({ ok: result.meta.changes > 0 });
});

scheduleRoutes.post('/schedule/:id/reorder', zValidator('json', z.object({ direction: z.enum(['up', 'down']) })), async (c) => {
  const tripId = c.get('tripId'); const id = Number(c.req.param('id')); const { direction } = c.req.valid('json');
  const item = await c.env.DB.prepare('SELECT id,trip_day_id,start_time,sort_order FROM schedule_items WHERE id=? AND trip_id=?').bind(id, tripId).first<{id:number;trip_day_id:number;start_time:string|null;sort_order:number}>();
  if (!item) return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
  const operator = direction === 'up' ? '<' : '>'; const ordering = direction === 'up' ? 'DESC' : 'ASC';
  const neighbor = await c.env.DB.prepare(`SELECT id,sort_order FROM schedule_items WHERE trip_id=? AND trip_day_id=? AND start_time IS ? AND sort_order ${operator} ? ORDER BY sort_order ${ordering},id ${ordering} LIMIT 1`).bind(tripId,item.trip_day_id,item.start_time,item.sort_order).first<{id:number;sort_order:number}>();
  if (!neighbor) return c.json({ ok: true });
  await c.env.DB.batch([c.env.DB.prepare('UPDATE schedule_items SET sort_order=? WHERE id=? AND trip_id=?').bind(neighbor.sort_order,item.id,tripId),c.env.DB.prepare('UPDATE schedule_items SET sort_order=? WHERE id=? AND trip_id=?').bind(item.sort_order,neighbor.id,tripId)]);
  return c.json({ ok: true });
});
