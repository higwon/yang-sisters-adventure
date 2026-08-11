import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export const reservationRoutes = new Hono<AppEnv>();
const schema = z.object({
  title: z.string().trim().min(1), type: z.string().trim().min(1),
  reservation_date: z.string().date().nullable().optional(),
  start_at: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullable().optional(),
  end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullable().optional(),
  confirmation_number: z.string().nullable().optional(), link: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(), attachment_ids: z.array(z.number().int().positive()).default([]),
});

async function validAttachments(db: D1Database, tripId: number, ids: number[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const placeholders = unique.map(() => '?').join(',');
  const count = await db.prepare(`SELECT COUNT(*) count FROM attachments a JOIN posts p ON p.id=a.post_id WHERE p.trip_id=? AND a.id IN (${placeholders})`).bind(tripId, ...unique).first<number>('count');
  if (count !== unique.length) throw new Error('현재 여행의 첨부파일만 선택할 수 있어요.');
  return unique;
}

reservationRoutes.get('/reservations', async (c) => c.json((await c.env.DB.prepare(
  `SELECT r.*,(SELECT json_group_array(json_object('id',a.id,'file_name',a.file_name,'content_type',a.content_type,'byte_size',a.byte_size)) FROM reservation_attachments ra JOIN attachments a ON a.id=ra.attachment_id WHERE ra.reservation_id=r.id) attachments
   FROM reservations r WHERE r.trip_id=? ORDER BY COALESCE(r.start_at,r.reservation_date),r.id`,
).bind(c.get('tripId')).all()).results));

reservationRoutes.post('/reservations', zValidator('json', schema), async (c) => {
  const tripId=c.get('tripId');const x=c.req.valid('json');
  try { const attachmentIds=await validAttachments(c.env.DB,tripId,x.attachment_ids);const row=await c.env.DB.prepare(
    `INSERT INTO reservations(trip_id,title,type,reservation_date,start_at,end_at,confirmation_number,link,notes) VALUES(?,?,?,?,?,?,?,?,?) RETURNING *`,
  ).bind(tripId,x.title,x.type,x.reservation_date??x.start_at?.slice(0,10)??null,x.start_at??null,x.end_at??null,x.confirmation_number??null,x.link??null,x.notes??null).first<{id:number}>();
  if(!row)throw new Error('예약을 저장하지 못했어요.');if(attachmentIds.length)await c.env.DB.batch(attachmentIds.map((id)=>c.env.DB.prepare('INSERT INTO reservation_attachments(reservation_id,attachment_id) VALUES(?,?)').bind(row.id,id)));return c.json(row,201);
  }catch(error){return c.json({error:error instanceof Error?error.message:'예약을 저장하지 못했어요.'},400);}
});

reservationRoutes.patch('/reservations/:id', zValidator('json', schema.partial()), async (c) => {
  const current = await c.env.DB.prepare('SELECT * FROM reservations WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<Record<string, unknown>>();
  if (!current) return c.json({ error: '예약 정보를 찾을 수 없습니다.' }, 404);
  const data=c.req.valid('json');const x={...current,...data};
  try{const attachmentIds=data.attachment_ids===undefined?null:await validAttachments(c.env.DB,c.get('tripId'),data.attachment_ids);const row=await c.env.DB.prepare(
    `UPDATE reservations SET title=?,type=?,reservation_date=?,start_at=?,end_at=?,confirmation_number=?,link=?,notes=? WHERE id=? AND trip_id=? RETURNING *`,
  ).bind(x.title,x.type,x.reservation_date??(String(x.start_at??'').slice(0,10)||null),x.start_at??null,x.end_at??null,x.confirmation_number??null,x.link??null,x.notes??null,c.req.param('id'),c.get('tripId')).first();
  if(attachmentIds){await c.env.DB.batch([c.env.DB.prepare('DELETE FROM reservation_attachments WHERE reservation_id=?').bind(c.req.param('id')),...attachmentIds.map((id)=>c.env.DB.prepare('INSERT INTO reservation_attachments(reservation_id,attachment_id) VALUES(?,?)').bind(c.req.param('id'),id))]);}return c.json(row);
  }catch(error){return c.json({error:error instanceof Error?error.message:'예약을 수정하지 못했어요.'},400);}
});

reservationRoutes.delete('/reservations/:id', async (c) => c.json({ ok: (await c.env.DB.prepare(
  'DELETE FROM reservations WHERE id=? AND trip_id=?',
).bind(c.req.param('id'), c.get('tripId')).run()).meta.changes > 0 }));
