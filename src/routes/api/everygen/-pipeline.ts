import { AIMediaType, FalProvider, AITaskStatus as FalStatus } from '@/core/ai';
import {
  AITaskStatus,
  claimTaskStatus,
  findTask,
  mergeTaskInfo,
  updateTask,
} from '@/modules/ai-tasks/service';
import { getStorage } from '@/modules/storage/service';

export const PIPELINE_MODEL = 'everygen-golden-hour-v1';
export const IMAGE_MODEL = 'openai/gpt-image-2/edit';
export const VIDEO_MODEL = 'fal-ai/kling-video/v2.6/pro/image-to-video';
export const STYLES = ['pier', 'coast', 'breeze', 'film'] as const;
export type Style = (typeof STYLES)[number];

const STYLE_DIRECTION: Record<Style, string> = {
  pier: 'On a quiet wooden pier above the sea at sunset, warm amber sky and distant horizon.',
  coast:
    'On a peaceful coastal promenade at golden hour, soft peach sky and glowing water.',
  breeze:
    'Beside the ocean at dusk, hair and clothing moving gently in a warm sea breeze.',
  film: 'At the seaside during sunset, nostalgic 35 mm film texture, subtle grain and warm halation.',
};

const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_PHOTO_CHARS = 8 * 1024 * 1024;

export function parseInput(
  body: unknown
): { photo: string; style: Style } | null {
  if (!body || typeof body !== 'object') return null;
  const { photo, style } = body as Record<string, unknown>;
  if (typeof photo !== 'string' || photo.length > MAX_PHOTO_CHARS) return null;
  const match = PHOTO_RE.exec(photo);
  if (!match || match[2].length % 4 !== 0) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 1024 || bytes.length > 6 * 1024 * 1024) return null;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!({ jpeg, png, webp }[match[1]] ?? false)) return null;
  return {
    photo,
    style: STYLES.includes(style as Style) ? (style as Style) : 'pier',
  };
}

export function scenePrompt(style: Style) {
  return `Edit the uploaded photo into a single vertical 9:16 cinematic portrait frame for a social video. The uploaded person is the only person in the scene. Preserve their recognizable face, identity, skin tone, hairstyle, age, and natural proportions. Show them from knees up with room around the body for natural animation. ${STYLE_DIRECTION[style]} Gentle golden-hour backlight, cinematic composition, realistic photography. No text, logo, watermark, other people, celebrity likeness, or explicit content.`;
}

const MOTION_PROMPT =
  'The same person remains recognizable and alone on the sunset seaside pier. They take one slow natural step, turn slightly toward the horizon and smile softly. A gentle sea breeze moves their hair and clothing. Golden light shimmers across the water. Smooth subtle camera push-in, cinematic and realistic, stable face and anatomy, one continuous shot. No speaking, singing, lip sync, text or logos.';

type Info = {
  imageRequestId?: string;
  videoRequestId?: string;
  sceneImageUrl?: string;
  videoClaimedAt?: number;
  persistAttempts?: number;
};
function parseJson<T>(value: unknown): T {
  try {
    return value ? JSON.parse(value as string) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function taskView(task: any) {
  const info = parseJson<Info>(task.taskInfo);
  const result = parseJson<{ video?: { url?: string }; error?: string }>(
    task.taskResult
  );
  return {
    id: task.id as string,
    status: task.status as AITaskStatus,
    stage:
      task.status === AITaskStatus.PENDING
        ? 'scene'
        : task.status === AITaskStatus.PROCESSING
          ? 'video'
          : null,
    sceneImageUrl: info.sceneImageUrl ?? null,
    videoUrl: result.video?.url ?? null,
    error: result.error ?? null,
  };
}

async function fail(taskId: string, message: string) {
  const task = await findTask(taskId);
  if (
    !task ||
    ![AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  )
    return;
  if (
    await claimTaskStatus(
      taskId,
      task.status as AITaskStatus,
      AITaskStatus.FAILED
    )
  ) {
    await updateTask({
      taskId,
      status: AITaskStatus.FAILED,
      taskResult: { error: message },
    });
  }
}

function isTransient(error: unknown) {
  const message = String((error as Error)?.message ?? error);
  const status = /request failed with status: (\d{3})/.exec(message)?.[1];
  return status
    ? status === '429' || Number(status) >= 500
    : /network|fetch failed|timed? ?out|ECONN|socket/i.test(message) ||
        error instanceof TypeError;
}

async function persistVideo(taskId: string, result: any) {
  const url: string | undefined = result?.video?.url;
  if (!url || !/^https:\/\/[^/]*fal\.media\//.test(url)) return result;
  try {
    const storage = await getStorage();
    if (!storage) return result;
    const uploaded = await storage.downloadAndUpload({
      url,
      key: `everygen/videos/${taskId}.mp4`,
      contentType: 'video/mp4',
      disposition: 'inline',
    });
    return uploaded.success && uploaded.url
      ? { ...result, video: { ...result.video, url: uploaded.url } }
      : result;
  } catch (error) {
    console.error('Everygen video persistence failed', taskId, error);
    return result;
  }
}

export async function repersistTask(task: {
  id: string;
  taskInfo: unknown;
  taskResult: unknown;
}) {
  const info = parseJson<Info>(task.taskInfo);
  if ((info.persistAttempts ?? 0) >= 3 || !(await getStorage())) return false;
  await mergeTaskInfo(task.id, {
    persistAttempts: (info.persistAttempts ?? 0) + 1,
  });
  const result = parseJson<any>(task.taskResult);
  const saved = await persistVideo(task.id, result);
  if (saved === result) return false;
  await updateTask({
    taskId: task.id,
    status: AITaskStatus.SUCCESS,
    taskResult: saved,
  });
  return true;
}

export async function advance(taskId: string, provider: FalProvider) {
  let task = await findTask(taskId);
  if (!task) throw new Error('Task not found');
  const info = parseJson<Info>(task.taskInfo);
  try {
    if (task.status === AITaskStatus.PENDING && info.imageRequestId) {
      const image = await provider.query({
        taskId: info.imageRequestId,
        model: IMAGE_MODEL,
        mediaType: AIMediaType.IMAGE,
      });
      if (image.taskStatus === FalStatus.FAILED)
        await fail(taskId, 'Scene generation failed');
      else if (image.taskStatus === FalStatus.SUCCESS) {
        const sceneImageUrl = image.taskInfo?.images?.[0]?.imageUrl;
        if (!sceneImageUrl)
          await fail(taskId, 'Scene generation returned no image');
        else if (
          await claimTaskStatus(
            taskId,
            AITaskStatus.PENDING,
            AITaskStatus.PROCESSING
          )
        ) {
          try {
            await mergeTaskInfo(taskId, {
              sceneImageUrl,
              videoClaimedAt: Date.now(),
            });
            const video = await provider.generate({
              params: {
                mediaType: AIMediaType.VIDEO,
                model: VIDEO_MODEL,
                prompt: MOTION_PROMPT,
                options: {
                  start_image_url: sceneImageUrl,
                  duration: '5',
                  generate_audio: false,
                },
              },
            });
            await mergeTaskInfo(taskId, { videoRequestId: video.taskId });
          } catch (error: any) {
            await fail(taskId, error?.message || 'Video generation failed');
          }
        }
      }
    } else if (task.status === AITaskStatus.PROCESSING && info.videoRequestId) {
      const video = await provider.query({
        taskId: info.videoRequestId,
        model: VIDEO_MODEL,
        mediaType: AIMediaType.VIDEO,
      });
      if (video.taskStatus === FalStatus.FAILED)
        await fail(taskId, 'Video generation failed');
      else if (video.taskStatus === FalStatus.SUCCESS) {
        if (!video.taskResult?.video?.url)
          await fail(taskId, 'Video generation returned no video');
        else
          await updateTask({
            taskId,
            status: AITaskStatus.SUCCESS,
            taskResult: await persistVideo(taskId, video.taskResult),
          });
      }
    } else if (
      task.status === AITaskStatus.PROCESSING &&
      info.videoClaimedAt &&
      Date.now() - info.videoClaimedAt > 10 * 60_000
    ) {
      await fail(taskId, 'Video generation could not be started');
    }
  } catch (error: any) {
    if (!isTransient(error))
      await fail(taskId, error?.message || 'Generation failed');
  }
  task = await findTask(taskId);
  return taskView(task);
}

export async function failTimedOut(taskId: string) {
  await fail(taskId, 'Generation timed out');
}
export async function failSubmission(taskId: string, message: string) {
  await fail(taskId, message);
}
