import { describe, expect, it } from 'vitest';
import { constantTimeEqual, hashSessionToken } from './auth';

describe('authentication primitives', () => {
  it('stores only a hash of the session token', async () => {
    const token = 'session-token';
    const hash = await hashSessionToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });

  it('compares OAuth state hashes without direct secret comparison', () => {
    expect(constantTimeEqual('same-state', 'same-state')).toBe(true);
    expect(constantTimeEqual('same-state', 'other-stat')).toBe(false);
  });
});
