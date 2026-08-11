import { describe, expect, it } from 'vitest';
import { googleAuthorizationUrl, googleRedirectUri } from './google-auth';

describe('Google OAuth configuration', () => {
  it('derives an exact callback URL from the request origin', () => {
    expect(googleRedirectUri('https://travel.example/api/auth/google')).toBe(
      'https://travel.example/api/auth/google/callback',
    );
  });

  it('builds the authorization-code request with identity scopes and state', () => {
    const url = new URL(googleAuthorizationUrl('client-id', 'https://travel.example/callback', 'state-value'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-value');
  });
});
