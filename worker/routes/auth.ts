import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth';
import { createSessionToken, hashSessionToken } from '../services/auth';
import type { AppEnv } from '../types';

const SESSION_SECONDS = 60 * 60 * 24 * 30;
const profileSelection = z.object({ user_id: z.number().int().positive() });
const profileUpdate = z.object({ name: z.string().trim().min(1).max(30) });
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

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
    'SELECT id, name, avatar_color, avatar_key FROM users WHERE is_active = 1 ORDER BY id',
  ).all<{ id: number; name: string; avatar_color: string; avatar_key: string | null }>();
  return c.json({ profiles: profiles.results });
});

authRoutes.post('/profile', zValidator('json', profileSelection), async (c) => {
  const { user_id: userId } = c.req.valid('json');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, avatar_color, avatar_key FROM users WHERE id = ? AND is_active = 1',
  ).bind(userId).first<{ id: number; name: string; email: string; avatar_color: string; avatar_key: string | null }>();
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

authRoutes.patch('/me', requireAuth, zValidator('json', profileUpdate), async (c) => {
  const { name } = c.req.valid('json');
  await c.env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(name, c.get('userId')).run();
  return c.json({ user: { ...c.get('user'), name } });
});

authRoutes.post('/me/avatar', requireAuth, async (c) => {
  const body = await c.req.parseBody(); const file = body.file;
  if (!(file instanceof File) || !AVATAR_TYPES.has(file.type) || file.size > AVATAR_MAX_BYTES) {
    return c.json({ error: 'JPEG, PNG, WEBP 이미지를 2MB 이하로 올려 주세요.' }, 400);
  }
  const previous = c.get('user').avatar_key;
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const key = `profiles/${c.get('userId')}/${crypto.randomUUID()}.${extension}`;
  await c.env.ATTACHMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await c.env.DB.prepare('UPDATE users SET avatar_key=? WHERE id=?').bind(key, c.get('userId')).run();
  if (previous) await c.env.ATTACHMENTS.delete(previous);
  return c.json({ avatar_key: key });
});

authRoutes.delete('/me/avatar', requireAuth, async (c) => {
  const key = c.get('user').avatar_key;
  await c.env.DB.prepare('UPDATE users SET avatar_key=NULL WHERE id=?').bind(c.get('userId')).run();
  if (key) await c.env.ATTACHMENTS.delete(key);
  return c.json({ ok: true });
});

authRoutes.get('/profiles/:id/avatar', async (c) => {
  const profile = await c.env.DB.prepare('SELECT avatar_key FROM users WHERE id=? AND is_active=1').bind(c.req.param('id')).first<{ avatar_key: string | null }>();
  if (!profile?.avatar_key) return c.notFound();
  const object = await c.env.ATTACHMENTS.get(profile.avatar_key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': 'private, max-age=300' } });
});
