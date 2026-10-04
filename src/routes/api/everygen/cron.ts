import { createFileRoute } from '@tanstack/react-router';

import { FalProvider } from '@/core/ai';
import { envConfigs } from '@/config';
import { AITaskStatus, listTasksByStatus } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

import {
  advance,
  failTimedOut,
  PIPELINE_MODEL,
  repersistTask,
} from './-pipeline';

async function POST({ request }: { request: Request }) {
  const secret = envConfigs.auth_secret;
  if (!secret || request.headers.get('x-cron-key') !== secret)
    return respErr('Unauthorized');
  const configs = await getAllConfigs();
  if (!configs.fal_api_key) return respData({ skipped: true });
  const provider = new FalProvider({ apiKey: configs.fal_api_key });
  const stats = { advanced: 0, timedOut: 0, persisted: 0 };
  const active = await listTasksByStatus({
    model: PIPELINE_MODEL,
    statuses: [AITaskStatus.PENDING, AITaskStatus.PROCESSING],
    limit: 25,
  });
  for (const task of active) {
    try {
      if (Date.now() - new Date(task.createdAt).getTime() > 3 * 60 * 60_000) {
        await failTimedOut(task.id);
        stats.timedOut++;
      } else {
        await advance(task.id, provider);
        stats.advanced++;
      }
    } catch (error) {
      console.error('Everygen cron task failed', task.id, error);
    }
  }
  const unsaved = await listTasksByStatus({
    model: PIPELINE_MODEL,
    statuses: [AITaskStatus.SUCCESS],
    resultLike: '%fal.media%',
    infoNotLike: '%"persistAttempts":3%',
    limit: 3,
  });
  for (const task of unsaved) if (await repersistTask(task)) stats.persisted++;
  return respData(stats);
}

export const Route = createFileRoute('/api/everygen/cron')({
  server: { handlers: { POST } },
});
