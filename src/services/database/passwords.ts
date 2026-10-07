/**
 * Password hashing for LOCAL demo mode (PBKDF2-SHA256, 100k iterations, random salt).
 * Plaintext passwords are never stored. In Supabase mode, Supabase Auth handles this.
 */
const enc = new TextEncoder();
const toHex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

export async function hashPassword(password: string, saltHex?: string): Promise<string> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256);
  return `pbkdf2$${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const again = await hashPassword(password, salt);
  // constant-time-ish compare
  const a = again.split('$')[2];
  let diff = a.length ^ hash.length;
  for (let i = 0; i < Math.min(a.length, hash.length); i++) diff |= a.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
