const encoder = new TextEncoder();
const ITERATIONS = 210_000;

const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);

export const normalizeLoginIdentifier = (value: string) => value.trim().toLowerCase();

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, saltHex, expectedHex] = storedHash.split('$');
  if (algorithm !== 'pbkdf2-sha256' || Number(iterations) !== ITERATIONS || !saltHex || !expectedHex) return false;
  const actual = await hashPassword(password, fromHex(saltHex));
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(storedHash);
  if (actualBytes.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) difference |= actualBytes[index] ^ expectedBytes[index];
  return difference === 0;
}

export function createSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return toHex(new Uint8Array(digest));
}
