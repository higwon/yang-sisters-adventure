import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth';
import { constantTimeEqual, createSessionToken, hashSessionToken } from '../services/auth';
import { fetchGoogleProfile, googleAuthorizationUrl, googleRedirectUri, type GoogleProfile } from '../services/google-auth';
import type { AppEnv } from '../types';

const SESSION_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_SECONDS = 10 * 60;
const OAUTH_STATE_COOKIE = 'google_oauth_state';

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

async function findOrCreateGoogleUser(c: Context<AppEnv>, profile: GoogleProfile) {
  const byGoogleId = await c.env.DB.prepare(
    'SELECT id FROM users WHERE google_sub = ?',
  ).bind(profile.sub).first<{ id: number }>();
  if (byGoogleId) return byGoogleId.id;

  const byEmail = await c.env.DB.prepare(
    'SELECT id, google_sub FROM users WHERE email = ?',
  ).bind(profile.email).first<{ id: number; google_sub: string | null }>();
  if (byEmail?.google_sub && byEmail.google_sub !== profile.sub) {
    throw new Error('Google account conflict');
  }
  if (byEmail) {
    await c.env.DB.prepare(
      'UPDATE users SET google_sub = ?, name = ?, login_identifier = NULL, password_hash = NULL WHERE id = ?',
    ).bind(profile.sub, profile.name ?? profile.email, byEmail.id).run();
    return byEmail.id;
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO users(name, email, avatar_color, google_sub)
     VALUES (?, ?, '#e8795a', ?)`,
  ).bind(profile.name ?? profile.email, profile.email, profile.sub).run();
  return Number(result.meta.last_row_id);
}

authRoutes.get('/google', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.redirect('/?auth_error=not_configured');
  }

  const state = createSessionToken();
  const stateId = await hashSessionToken(state);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= datetime('now')"),
    c.env.DB.prepare(
      "INSERT INTO oauth_states(id, expires_at) VALUES (?, datetime('now', '+10 minutes'))",
    ).bind(stateId),
  ]);
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/api/auth/google/callback',
    maxAge: OAUTH_STATE_SECONDS,
  });
  return c.redirect(googleAuthorizationUrl(
    c.env.GOOGLE_CLIENT_ID,
    googleRedirectUri(c.req.url),
    state,
  ));
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const returnedState = c.req.query('state');
  const cookieState = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/api/auth/google/callback' });

  if (c.req.query('error') || !code || !returnedState || !cookieState) {
    return c.redirect('/?auth_error=google_denied');
  }
  const [returnedStateId, cookieStateId] = await Promise.all([
    hashSessionToken(returnedState),
    hashSessionToken(cookieState),
  ]);
  if (!constantTimeEqual(returnedStateId, cookieStateId)) return c.redirect('/?auth_error=invalid_state');

  const consumed = await c.env.DB.prepare(
    "DELETE FROM oauth_states WHERE id = ? AND expires_at > datetime('now')",
  ).bind(returnedStateId).run();
  if (consumed.meta.changes !== 1) return c.redirect('/?auth_error=invalid_state');
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.redirect('/?auth_error=not_configured');
  }

  try {
    const profile = await fetchGoogleProfile(
      code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUri(c.req.url),
    );
    const userId = await findOrCreateGoogleUser(c, profile);
    await startSession(c, userId);
    return c.redirect('/');
  } catch (error) {
    console.error(JSON.stringify({ event: 'google_oauth_failed', error: String(error) }));
    return c.redirect('/?auth_error=google_failed');
  }
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await hashSessionToken(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => c.json({ user: c.get('user') }));
