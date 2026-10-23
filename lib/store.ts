import 'server-only';
import { list, del } from '@vercel/blob';

/*
 * Everything lives in Vercel Blob — no database needed.
 * Each blob's pathname carries its own metadata, so the site is always
 * read fresh with list() and never from a stale CDN copy.
 *
 *   posters/{added}-{rand}_{pw}x{ph}_{nameB64}.{ext}
 */

export type Poster = {
  url: string;
  name: string;
  pw: number; // pixel width
  ph: number; // pixel height
  added: number;
};

export const POSTER_PATH =
  /^posters\/(\d{10,16})-([a-z0-9]{4,12})_(\d{1,6})x(\d{1,6})_([A-Za-z0-9_-]{0,200})\.(jpe?g|png|webp|gif|avif)$/;

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
