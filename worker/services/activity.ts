import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

const labels: Record<string, string> = {
  schedule: '일정', planning: '일정 후보', places: '장소', posts: '보드 게시물', checklist: '체크리스트',
  expenses: '비용', reservations: '예약', attachments: '첨부파일',
};

export async function logActivity(db: D1Database, data: {
  tripId: number; actorId: number; action: 'create' | 'update' | 'delete'; entityType: string; entityId?: string | number | null; summary: string;
}) {
  await db.prepare('INSERT INTO activity_logs(trip_id,actor_id,action,entity_type,entity_id,summary) VALUES(?,?,?,?,?,?)')
    .bind(data.tripId, data.actorId, data.action, data.entityType, data.entityId == null ? null : String(data.entityId), data.summary).run();
}

export const activityMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!['POST', 'PATCH', 'DELETE'].includes(c.req.method) || c.res.status >= 400) return;
  const parts = new URL(c.req.url).pathname.split('/').filter(Boolean);
  const tripIndex = parts.indexOf('trips');
  const entityType = parts[tripIndex + 2];
  if (!entityType || entityType === 'dashboard' || entityType === 'attachments') return;
  const action = c.req.method === 'POST' ? (parts[tripIndex + 3] ? 'update' : 'create') : c.req.method === 'PATCH' ? 'update' : 'delete';
  let responseId: string | number | undefined;
  try {
    const body = await c.res.clone().json() as Record<string, unknown>;
    if (body.ok === false) return;
    responseId = body.id as string | number | undefined ?? body.schedule_item_id as number | undefined;
  } catch { /* responses without JSON identifiers are valid */ }
  const pathId = parts[tripIndex + 3];
  const label = labels[entityType] ?? entityType;
  try {
    await logActivity(c.env.DB, {
      tripId: c.get('tripId'), actorId: c.get('userId'), action, entityType,
      entityId: responseId ?? (pathId && !Number.isNaN(Number(pathId)) ? pathId : null),
      summary: `${label}을 ${action === 'create' ? '추가' : action === 'update' ? '수정' : '삭제'}했어요.`,
    });
  } catch (error) { console.error('activity log failed', error); }
};
