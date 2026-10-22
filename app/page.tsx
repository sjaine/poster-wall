import PosterWall from './PosterWall';
import { getPosters, getSettings, DEFAULT_SETTINGS } from '@/lib/store';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [posters, settings, admin] = await Promise.all([
    getPosters().catch(() => []),
    getSettings().catch(() => DEFAULT_SETTINGS),
    isAdmin(),
  ]);
  return <PosterWall initialPosters={posters} initialSettings={settings} initialAdmin={admin} />;
}
