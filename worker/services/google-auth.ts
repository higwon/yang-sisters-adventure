const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

export function googleRedirectUri(requestUrl: string) {
  return `${new URL(requestUrl).origin}/api/auth/google/callback`;
}

export function googleAuthorizationUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  }).toString();
  return url.toString();
}

export async function fetchGoogleProfile(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) throw new Error('Google token exchange failed');
  const token = await tokenResponse.json<{ access_token?: string }>();
  if (!token.access_token) throw new Error('Google access token missing');

  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('Google userinfo request failed');
  const profile = await profileResponse.json<GoogleProfile>();
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error('Google profile is incomplete or unverified');
  }
  return profile;
}
