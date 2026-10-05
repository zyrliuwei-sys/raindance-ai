import { createFileRoute } from '@tanstack/react-router';

import { AIMediaType } from '@/core/ai';
import { EvolinkClient } from '@/core/ai/evolink';
import { getAuth } from '@/core/auth';
import { everygenCredits } from '@/config/everygen-pricing';
import { createTask, mergeTaskInfo } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance } from '@/modules/credits/service';
import {
  assignPosterUser,
  findPoster,
  PosterStatus,
} from '@/modules/everygen-poster/service';
import { hasPermission } from '@/modules/rbac/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

import {
  failSubmission,
  parseVideoOptions,
  PIPELINE_MODEL,
  scenePrompt,
  STYLES,
  submitHdScene,
  taskView,
  type Style,
} from './-pipeline';

// Paid step: re-render a free poster at 2K, then animate it with Seedance
// (advance() starts the video once the HD image is ready).
async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized');
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 5000,
      keyPrefix: 'raindance-generate',
      extraKey: session.user.id,
    });
    if (limited) return limited;
    const body = await request.json().catch(() => null);
    const posterId = (body as any)?.posterId;
    const poster =
      typeof posterId === 'string' ? await findPoster(posterId) : undefined;
    if (
      !poster ||
      poster.status !== PosterStatus.SUCCESS ||
      !poster.imageUrl ||
      (poster.userId && poster.userId !== session.user.id)
    )
      return respErr('Poster not found');
    const options = parseVideoOptions(body);
    const configs = await getAllConfigs();
    const admin = await hasPermission(session.user.id, 'admin.*');
    const price = everygenCredits(options.duration, options.quality);
    if (!admin && (await getBalance(session.user.id)) < price)
      return respErr('Insufficient credits');
    if (!configs.evolink_api_key)
      return respErr('Generation is not configured');

    if (!poster.userId) await assignPosterUser(poster.id, session.user.id);
    const style = (
      STYLES.includes(poster.style as Style) ? poster.style : 'pier'
    ) as Style;
    const task = await createTask({
      userId: session.user.id,
      mediaType: AIMediaType.VIDEO,
      provider: 'evolink',
      model: PIPELINE_MODEL,
      prompt: scenePrompt(style),
      costCredits: admin ? 0 : price,
    });
    try {
      const imageRequestId = await submitHdScene(
        new EvolinkClient({
          apiKey: configs.evolink_api_key,
          baseUrl: configs.evolink_base_url,
        }),
        { ...poster, imageUrl: poster.imageUrl }
      );
      await mergeTaskInfo(task.id, {
        imageRequestId,
        posterId: poster.id,
        posterImageUrl: poster.imageUrl,
        style,
        ...options,
      });
    } catch (error) {
      console.error('Raindance video submission failed', task.id, error);
      await failSubmission(task.id, 'Video submission failed');
      return respErr('Video submission failed');
    }
    return respData({ ...taskView(task), sceneImageUrl: poster.imageUrl });
  } catch (error) {
    console.error('Raindance generation failed', error);
    return respErr('Generation failed');
  }
}

export const Route = createFileRoute('/api/everygen/generate')({
  server: { handlers: { POST } },
});
