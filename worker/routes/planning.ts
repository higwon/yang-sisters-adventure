import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const planningRoutes = new Hono<AppEnv>();
const schema = z.object({ title: z.string().trim().min(1), item_type: z.string().trim().min(1), place_id: z.number().int().positive().nullable().optional(), url: z.string().url().nullable().optional(), notes: z.string().trim().nullable().optional() });
const convertSchema = z.object({ day_date: z.string().date(), start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional() });

async function validPlace(db: D1Database, tripId: number, placeId: number | null | undefined) {
  if (placeId && !await db.prepare('SELECT 1 FROM places WHERE id=? AND trip_id=?').bind(placeId, tripId).first()) throw new Error('현재 여행의 장소만 선택할 수 있습니다.');
}

planningRoutes.get('/planning', async (c) => {
  const result = await c.env.DB.prepare(`SELECT pi.*,p.name place_name,u.name created_by_name FROM planning_items pi LEFT JOIN places p ON p.id=pi.place_id JOIN users u ON u.id=pi.created_by WHERE pi.trip_id=? ORDER BY pi.status,pi.created_at DESC`).bind(c.get('tripId')).all();
  return c.json(result.results);
});
planningRoutes.post('/planning', zValidator('json', schema), async (c) => {
  const tripId=c.get('tripId'); const data=c.req.valid('json');
  try { await validPlace(c.env.DB,tripId,data.place_id); const row=await c.env.DB.prepare('INSERT INTO planning_items(trip_id,title,item_type,place_id,url,notes,created_by) VALUES(?,?,?,?,?,?,?) RETURNING *').bind(tripId,data.title,data.item_type,data.place_id??null,data.url??null,data.notes??null,c.get('userId')).first(); return c.json(row,201); }
  catch(error){ return c.json({error:error instanceof Error?error.message:'후보를 저장하지 못했습니다.'},400); }
});
planningRoutes.patch('/planning/:id', zValidator('json', schema.partial()), async (c) => {
  const tripId=c.get('tripId'); const current=await c.env.DB.prepare('SELECT * FROM planning_items WHERE id=? AND trip_id=? AND status=\'inbox\'').bind(c.req.param('id'),tripId).first<Record<string,unknown>>();
  if(!current)return c.json({error:'일정 후보를 찾을 수 없습니다.'},404); const data=c.req.valid('json'); const merged={...current,...data};
  try { await validPlace(c.env.DB,tripId,merged.place_id as number|null); const row=await c.env.DB.prepare('UPDATE planning_items SET title=?,item_type=?,place_id=?,url=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND trip_id=? RETURNING *').bind(merged.title,merged.item_type,merged.place_id??null,merged.url??null,merged.notes??null,c.req.param('id'),tripId).first(); return c.json(row); }
  catch(error){return c.json({error:error instanceof Error?error.message:'후보를 수정하지 못했습니다.'},400);}
});
planningRoutes.delete('/planning/:id', async(c)=>{const result=await c.env.DB.prepare('DELETE FROM planning_items WHERE id=? AND trip_id=? AND status=\'inbox\'').bind(c.req.param('id'),c.get('tripId')).run();return c.json({ok:result.meta.changes>0});});
planningRoutes.post('/planning/:id/schedule',zValidator('json',convertSchema),async(c)=>{
  const tripId=c.get('tripId');const data=c.req.valid('json');const item=await c.env.DB.prepare('SELECT * FROM planning_items WHERE id=? AND trip_id=? AND status=\'inbox\'').bind(c.req.param('id'),tripId).first<Record<string,unknown>>();
  if(!item)return c.json({error:'일정 후보를 찾을 수 없습니다.'},404);const day=await c.env.DB.prepare('SELECT id FROM trip_days WHERE trip_id=? AND day_date=?').bind(tripId,data.day_date).first<{id:number}>();if(!day)return c.json({error:'여행 기간에 포함된 날짜를 선택해 주세요.'},400);
  const order=await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM schedule_items WHERE trip_day_id=? AND start_time IS ?').bind(day.id,data.start_time??null).first<number>('value')??0;
  const schedule=await c.env.DB.prepare(`INSERT INTO schedule_items(trip_id,trip_day_id,place_id,title,start_time,end_time,category,notes,status,url,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(tripId,day.id,item.place_id,item.title,data.start_time??null,data.end_time??null,item.item_type,item.notes,'candidate',item.url,order).first<{id:number}>();
  if(!schedule)return c.json({error:'일정으로 전환하지 못했습니다.'},400);await c.env.DB.prepare('UPDATE planning_items SET status=\'scheduled\',schedule_item_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND trip_id=?').bind(schedule.id,c.req.param('id'),tripId).run();return c.json({schedule_item_id:schedule.id},201);
});
