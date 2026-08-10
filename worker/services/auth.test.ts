import { describe, expect, it } from 'vitest';
import { hashPassword, hashSessionToken, normalizeLoginIdentifier, verifyPassword } from './auth';

describe('authentication primitives', () => {
  it('normalizes login identifiers', () => {
    expect(normalizeLoginIdentifier('  Sister@Example.COM ')).toBe('sister@example.com');
  });

  it('hashes and verifies passwords without retaining plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple', new Uint8Array(16).fill(7));
    expect(hash).not.toContain('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('stores only a hash of the session token', async () => {
    const token = 'session-token';
    const hash = await hashSessionToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });
});
