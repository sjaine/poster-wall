import PosterWall from './PosterWall';
import { getPosters } from '@/lib/store';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [posters, admin] = await Promise.all([getPosters().catch(() => []), isAdmin()]);
  return <PosterWall initialPosters={posters} initialAdmin={admin} />;
}
