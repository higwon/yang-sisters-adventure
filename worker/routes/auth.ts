import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth';
import { createSessionToken, hashSessionToken } from '../services/auth';
import type { AppEnv } from '../types';

const SESSION_SECONDS = 60 * 60 * 24 * 30;
const fixedProfileSelection = z.object({
  user_id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const authRoutes = new Hono<AppEnv>();

async function startSession(c: Context<AppEnv>, userId: number) {
  const previousToken = getCookie(c, SESSION_COOKIE);
  if (previousToken) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(await hashSessionToken(previousToken))
      .run();
  }
  const token = createSessionToken();
  const sessionId = await hashSessionToken(token);
  await c.env.DB.prepare(
    "INSERT INTO sessions(id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))",
  ).bind(sessionId, userId).run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

authRoutes.get('/profiles', async (c) => {
  const profiles = await c.env.DB.prepare(
    'SELECT id, name, avatar_color FROM users WHERE id IN (1, 2, 3) ORDER BY id',
  ).all<{ id: 1 | 2 | 3; name: string; avatar_color: string }>();
  return c.json({ profiles: profiles.results });
});

authRoutes.post('/profile', zValidator('json', fixedProfileSelection), async (c) => {
  const { user_id: userId } = c.req.valid('json');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, avatar_color FROM users WHERE id = ?',
  ).bind(userId).first<{ id: number; name: string; email: string; avatar_color: string }>();
  if (!user) return c.json({ error: '선택할 수 없는 프로필입니다.' }, 404);
  await startSession(c, user.id);
  return c.json({ user });
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await hashSessionToken(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => c.json({ user: c.get('user') }));
