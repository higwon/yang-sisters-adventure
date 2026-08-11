import { describe, expect, it } from 'vitest';
import { hashSessionToken } from './auth';

describe('authentication primitives', () => {
  it('stores only a hash of the session token', async () => {
    const token = 'session-token';
    const hash = await hashSessionToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });

});
