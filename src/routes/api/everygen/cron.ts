import { createFileRoute } from '@tanstack/react-router';

import { EvolinkClient } from '@/core/ai/evolink';
import { envConfigs } from '@/config';
import { AITaskStatus, listTasksByStatus } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { listPendingPosters } from '@/modules/everygen-poster/service';
import { respData, respErr } from '@/lib/resp';

import {
  advance,
  advancePoster,
  failTimedOut,
  PIPELINE_MODEL,
  repersistTask,
} from './-pipeline';

async function POST({ request }: { request: Request }) {
  const secret = envConfigs.auth_secret;
  if (!secret || request.headers.get('x-cron-key') !== secret)
    return respErr('Unauthorized');
  const configs = await getAllConfigs();
  if (!configs.evolink_api_key) return respData({ skipped: true });
  const provider = new EvolinkClient({
    apiKey: configs.evolink_api_key,
    baseUrl: configs.evolink_base_url,
  });
  const stats = { advanced: 0, timedOut: 0, persisted: 0, posters: 0 };
  // Settle posters whose visitor closed the tab, so the image still lands on R2.
  for (const poster of await listPendingPosters(25)) {
    try {
      await advancePoster(poster, provider);
      stats.posters++;
    } catch (error) {
      console.error('Everygen cron poster failed', poster.id, error);
    }
  }
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
    // Evolink result files are temporary; copy them to R2 when configured.
    resultLike: '%files.evolink.ai%',
    infoNotLike: '%"persistAttempts":3%',
    limit: 3,
  });
  for (const task of unsaved) if (await repersistTask(task)) stats.persisted++;
  return respData(stats);
}

export const Route = createFileRoute('/api/everygen/cron')({
  server: { handlers: { POST } },
});
