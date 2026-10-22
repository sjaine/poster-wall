import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { saveSettings, validSettings } from '@/lib/store';

export async function PUT(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Log in to change the default size.' }, { status: 401 });
  const s = validSettings(await request.json().catch(() => null));
  if (!s) return NextResponse.json({ error: 'Size must be between 1 and 200 inches.' }, { status: 400 });
  await saveSettings(s);
  return NextResponse.json(s);
}
