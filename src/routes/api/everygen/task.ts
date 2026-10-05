import { createFileRoute } from '@tanstack/react-router';

import { EvolinkClient } from '@/core/ai/evolink';
import { getAuth } from '@/core/auth';
import { AITaskStatus, findTask } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

import { advance, PIPELINE_MODEL, taskView } from './-pipeline';

async function GET({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return respErr('id is required');
    const task = await findTask(id);
    if (
      !task ||
      task.userId !== session.user.id ||
      task.model !== PIPELINE_MODEL
    )
      return respErr('Task not found');
    if (
      task.status === AITaskStatus.SUCCESS ||
      task.status === AITaskStatus.FAILED
    )
      return respData(taskView(task));
    const configs = await getAllConfigs();
    if (!configs.evolink_api_key)
      return respErr('Generation is not configured');
    return respData(
      await advance(
        id,
        new EvolinkClient({
          apiKey: configs.evolink_api_key,
          baseUrl: configs.evolink_base_url,
        })
      )
    );
  } catch (error: any) {
    return respErr(error?.message || 'Query failed');
  }
}

export const Route = createFileRoute('/api/everygen/task')({
  server: { handlers: { GET } },
});
