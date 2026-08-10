import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth';
import { createSessionToken, hashPassword, hashSessionToken, normalizeLoginIdentifier, verifyPassword } from '../services/auth';
import type { AppEnv } from '../types';

const credentials = z.object({ login_identifier: z.string().trim().min(3).max(254), password: z.string().min(10).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(60) });
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export const authRoutes = new Hono<AppEnv>();

async function startSession(c: Context<AppEnv>, userId: number) {
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

authRoutes.post('/register', zValidator('json', registration), async (c) => {
  const body = c.req.valid('json');
  const loginIdentifier = normalizeLoginIdentifier(body.login_identifier);
  const passwordHash = await hashPassword(body.password);
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO users(name, email, avatar_color, login_identifier, password_hash)
       VALUES (?, ?, '#e8795a', ?, ?)`,
    ).bind(body.name, loginIdentifier, loginIdentifier, passwordHash).run();
    const userId = Number(result.meta.last_row_id);
    await startSession(c, userId);
    return c.json({ user: { id: userId, name: body.name, email: loginIdentifier, avatar_color: '#e8795a' } }, 201);
  } catch (error) {
    if (String(error).includes('UNIQUE')) return c.json({ error: '이미 사용 중인 로그인 아이디입니다.' }, 409);
    throw error;
  }
});

authRoutes.post('/login', zValidator('json', credentials), async (c) => {
  const body = c.req.valid('json');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, avatar_color, password_hash FROM users WHERE login_identifier = ?',
  ).bind(normalizeLoginIdentifier(body.login_identifier)).first<{ id: number; name: string; email: string; avatar_color: string; password_hash: string | null }>();
  if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
    return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }
  await startSession(c, user.id);
  return c.json({ user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color } });
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await hashSessionToken(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => c.json({ user: c.get('user') }));
