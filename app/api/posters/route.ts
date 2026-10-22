import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { deletePoster } from '@/lib/store';

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Log in to remove posters.' }, { status: 401 });
  const { url } = await request.json().catch(() => ({}));
  if (typeof url !== 'string' || !(await deletePoster(url)))
    return NextResponse.json({ error: 'That poster could not be found.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
