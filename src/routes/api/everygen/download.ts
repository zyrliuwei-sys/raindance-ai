import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { AITaskStatus, findTask } from '@/modules/ai-tasks/service';
import { respErr } from '@/lib/resp';

import { PIPELINE_MODEL, taskView } from './-pipeline';

async function GET({ request }: { request: Request }) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return respErr('Unauthorized');
  const id = new URL(request.url).searchParams.get('id');
  const task = id ? await findTask(id) : undefined;
  if (
    !task ||
    task.userId !== session.user.id ||
    task.model !== PIPELINE_MODEL ||
    task.status !== AITaskStatus.SUCCESS
  )
    return respErr('Video not found');
  const { videoUrl } = taskView(task);
  if (!videoUrl || !videoUrl.startsWith('https://'))
    return respErr('Video not found');
  const upstream = await fetch(videoUrl);
  if (!upstream.ok || !upstream.body) return respErr('Video is unavailable');
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Content-Disposition': `attachment; filename="everygen-${task.id.slice(0, 8)}.mp4"`,
    'Cache-Control': 'private, no-store',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { headers });
}

export const Route = createFileRoute('/api/everygen/download')({
  server: { handlers: { GET } },
});
