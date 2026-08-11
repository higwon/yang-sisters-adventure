import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { hashSessionToken } from '../services/auth';
import type { AppEnv } from '../types';

export const SESSION_COOKIE = 'yang_session';

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: '로그인이 필요합니다.' }, 401);

  const sessionId = await hashSessionToken(token);
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.avatar_color, u.avatar_key
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1`,
  ).bind(sessionId).first<{ id: number; name: string; email: string; avatar_color: string; avatar_key: string | null }>();

  if (!user) return c.json({ error: '세션이 만료되었습니다.' }, 401);
  c.set('userId', user.id);
  c.set('user', user);
  await next();
};
