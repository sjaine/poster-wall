import 'server-only';
import { list, put, del } from '@vercel/blob';

/*
 * Everything lives in Vercel Blob — no database needed.
 * Each blob's pathname carries its own metadata, so the site is always
 * read fresh with list() and never from a stale CDN copy.
 *
 *   posters/{added}-{rand}_{pw}x{ph}_{nameB64}.{ext}
 *   settings/{savedAt}_{w}x{h}_{fit}.txt      (newest one wins)
 */

export type Poster = {
  url: string;
  name: string;
  pw: number; // pixel width
  ph: number; // pixel height
  added: number;
};

export type Fit = 'fill' | 'fit';
export type Settings = { w: number; h: number; fit: Fit };

export const DEFAULT_SETTINGS: Settings = { w: 9, h: 11, fit: 'fill' };

export const POSTER_PATH =
  /^posters\/(\d{10,16})-([a-z0-9]{4,12})_(\d{1,6})x(\d{1,6})_([A-Za-z0-9_-]{0,200})\.(jpe?g|png|webp|gif|avif)$/;
const SETTINGS_PATH = /^settings\/(\d{10,16})_(\d{1,3}(?:\.\d{1,2})?)x(\d{1,3}(?:\.\d{1,2})?)_(fill|fit)\.txt$/;

async function listAll(prefix: string) {
  const blobs: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function decodeName(b64: string) {
  try {
    return Buffer.from(b64, 'base64url').toString('utf8') || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

export async function getPosters(): Promise<Poster[]> {
  const blobs = await listAll('posters/');
  return blobs
    .map((b) => {
      const m = b.pathname.match(POSTER_PATH);
      if (!m) return null;
      return { url: b.url, added: +m[1], pw: +m[3], ph: +m[4], name: decodeName(m[5]) };
    })
    .filter((p): p is Poster => p !== null)
    .sort((a, b) => a.added - b.added);
}

export async function getSettings(): Promise<Settings> {
  const blobs = await listAll('settings/');
  let best: (Settings & { at: number }) | null = null;
  for (const b of blobs) {
    const m = b.pathname.match(SETTINGS_PATH);
    if (!m) continue;
    const at = +m[1];
    if (!best || at > best.at) best = { at, w: +m[2], h: +m[3], fit: m[4] as Fit };
  }
  return best ? { w: best.w, h: best.h, fit: best.fit } : DEFAULT_SETTINGS;
}

export function validSettings(v: unknown): Settings | null {
  if (!v || typeof v !== 'object') return null;
  const { w, h, fit } = v as Record<string, unknown>;
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 200;
  if (!ok(w) || !ok(h) || (fit !== 'fill' && fit !== 'fit')) return null;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { w: r(w as number), h: r(h as number), fit };
}

export async function saveSettings(s: Settings) {
  const at = Date.now();
  await put(`settings/${at}_${s.w}x${s.h}_${s.fit}.txt`, String(at), {
    access: 'public',
    contentType: 'text/plain',
  });
  // Keep only the newest settings blob.
  const old = (await listAll('settings/')).filter((b) => !b.pathname.startsWith(`settings/${at}_`));
  if (old.length) await del(old.map((b) => b.url));
}

export async function deletePoster(url: string) {
  let pathname: string;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('.blob.vercel-storage.com')) return false;
    pathname = decodeURIComponent(u.pathname.slice(1));
  } catch {
    return false;
  }
  if (!POSTER_PATH.test(pathname)) return false;
  await del(url);
  return true;
}
