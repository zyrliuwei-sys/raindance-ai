import { createFileRoute } from '@tanstack/react-router';

import { findPoster, PosterStatus } from '@/modules/everygen-poster/service';
import { respErr } from '@/lib/resp';

// Posters are free and public by id (an unguessable uuid), so no sign-in.
async function GET({ request }: { request: Request }) {
  const id = new URL(request.url).searchParams.get('id');
  const row = id ? await findPoster(id) : undefined;
  if (
    !row ||
    row.status !== PosterStatus.SUCCESS ||
    !row.imageUrl?.startsWith('https://')
  )
    return respErr('Poster not found');
  const upstream = await fetch(row.imageUrl);
  if (!upstream.ok || !upstream.body) return respErr('Poster is unavailable');
  const headers = new Headers({
    'Content-Type': 'image/jpeg',
    'Content-Disposition': `attachment; filename="raindance-poster-${row.id.slice(0, 8)}.jpg"`,
    'Cache-Control': 'private, no-store',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { headers });
}

export const Route = createFileRoute('/api/everygen/poster-download')({
  server: { handlers: { GET } },
});
