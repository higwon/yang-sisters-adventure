import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

export const tripContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const tripId = Number(c.req.param('tripId'));
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return c.json({ error: '유효하지 않은 여행 ID입니다.' }, 400);
  }

  const membership = await c.env.DB.prepare(
    'SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?',
  )
    .bind(tripId, c.get('userId'))
    .first();

  if (!membership) {
    return c.json({ error: '여행을 찾을 수 없거나 접근 권한이 없습니다.' }, 404);
  }

  c.set('tripId', tripId);
  await next();
};
