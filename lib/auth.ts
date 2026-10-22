import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/*
 * One admin, one password (ADMIN_PASSWORD env var).
 * Logging in sets an httpOnly cookie holding an HMAC of the password,
 * so changing ADMIN_PASSWORD on Vercel logs every session out.
 */

export const COOKIE = 'pw_admin';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_PASSWORD is not set');
  return s;
}

const sign = (value: string) =>
  createHmac('sha256', (process.env.SESSION_SECRET || '') + secret()).update(value).digest('hex');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(sign('cmp:' + a));
  const y = Buffer.from(sign('cmp:' + b));
  return timingSafeEqual(x, y);
}

export const sessionToken = () => sign('poster-wall-admin');

export function checkPassword(input: unknown) {
  return typeof input === 'string' && input.length > 0 && safeEqual(input, secret());
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && safeEqual(token, sessionToken());
}
