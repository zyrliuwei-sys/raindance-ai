import { createFileRoute } from '@tanstack/react-router';

import { AIMediaType, FalProvider } from '@/core/ai';
import { getAuth } from '@/core/auth';
import { resolveEverygenCredits } from '@/config/everygen-pricing';
import { createTask, mergeTaskInfo } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance } from '@/modules/credits/service';
import { hasPermission } from '@/modules/rbac/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

import {
  failSubmission,
  IMAGE_MODEL,
  parseInput,
  PIPELINE_MODEL,
  scenePrompt,
  taskView,
} from './-pipeline';

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

async function readInput(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_REQUEST_BYTES) throw new Error('Photo is too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Photo is required');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error('Photo is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Invalid photo request');
  }
}

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
    const body = await readInput(request);
    if (body?.consent !== true) return respErr('Photo consent is required');
    const input = parseInput(body);
    if (!input)
      return respErr('A JPG, PNG or WebP portrait under 6 MB is required');
    const configs = await getAllConfigs();
    const admin = await hasPermission(session.user.id, 'admin.*');
    const price = resolveEverygenCredits(configs);
    if (!admin && (await getBalance(session.user.id)) < price)
      return respErr('Insufficient credits');
    if (!configs.fal_api_key) return respErr('Generation is not configured');

    const task = await createTask({
      userId: session.user.id,
      mediaType: AIMediaType.VIDEO,
      provider: 'fal',
      model: PIPELINE_MODEL,
      prompt: scenePrompt(input.style),
      costCredits: admin ? 0 : price,
    });
    try {
      const provider = new FalProvider({ apiKey: configs.fal_api_key });
      const image = await provider.generate({
        params: {
          mediaType: AIMediaType.IMAGE,
          model: IMAGE_MODEL,
          prompt: scenePrompt(input.style),
          options: {
            image_urls: [input.photo],
            image_size: { width: 576, height: 1024 },
            quality: 'medium',
            output_format: 'jpeg',
          },
        },
      });
      await mergeTaskInfo(task.id, {
        imageRequestId: image.taskId,
        style: input.style,
      });
    } catch (error) {
      console.error('Raindance scene submission failed', task.id, error);
      await failSubmission(task.id, 'Scene submission failed');
      return respErr('Scene submission failed');
    }
    return respData(taskView(task));
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'Photo is too large',
        'Photo is required',
        'Invalid photo request',
        'Insufficient credits',
      ].includes(error.message)
    )
      return respErr(error.message);
    console.error('Raindance generation failed', error);
    return respErr('Generation failed');
  }
}

export const Route = createFileRoute('/api/everygen/generate')({
  server: { handlers: { POST } },
});
