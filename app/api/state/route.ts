import { NextResponse } from 'next/server';
import { getPosters, getSettings } from '@/lib/store';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [posters, settings, admin] = await Promise.all([getPosters(), getSettings(), isAdmin()]);
    return NextResponse.json({ posters, settings, admin }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load posters.' }, { status: 500 });
  }
}
