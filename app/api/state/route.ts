import { NextResponse } from 'next/server';
import { getPosters } from '@/lib/store';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [posters, admin] = await Promise.all([getPosters(), isAdmin()]);
    return NextResponse.json({ posters, admin }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load posters.' }, { status: 500 });
  }
}
