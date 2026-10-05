import { EvolinkClient } from '@/core/ai/evolink';
import {
  DEFAULT_DURATION,
  DEFAULT_QUALITY,
  DURATIONS,
  QUALITIES,
  type Duration,
  type Quality,
} from '@/config/everygen-pricing';
import {
  AITaskStatus,
  claimTaskStatus,
  findTask,
  mergeTaskInfo,
  updateTask,
} from '@/modules/ai-tasks/service';
import {
  claimPosterResult,
  PosterStatus,
  type findPoster,
} from '@/modules/everygen-poster/service';
import { getStorage } from '@/modules/storage/service';

export const PIPELINE_MODEL = 'everygen-golden-hour-v1';
export const IMAGE_MODEL = 'doubao-seedream-5.0-flash';
export const VIDEO_MODEL = 'seedance-2.0-image-to-video';
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

/** A portrait for the free poster. */
export function parsePhotoInput(
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

/** Length, resolution and sound for the paid video; unknown values fall back. */
export function parseVideoOptions(body: unknown): {
  duration: Duration;
  quality: Quality;
  audio: boolean;
} {
  const { duration, quality, audio } = (body ?? {}) as Record<string, unknown>;
  return {
    duration: DURATIONS.includes(duration as Duration)
      ? (duration as Duration)
      : DEFAULT_DURATION,
    quality: QUALITIES.includes(quality as Quality)
      ? (quality as Quality)
      : DEFAULT_QUALITY,
    audio: audio === true,
  };
}

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

/** JSON body with a hard size cap (the photo arrives as a data URL). */
export async function readInput(request: Request): Promise<unknown> {
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

export function scenePrompt(style: Style) {
  return `Edit the uploaded photo into a single vertical 9:16 cinematic portrait frame for a social video. The uploaded person is the only person in the scene. Preserve their recognizable face, identity, skin tone, hairstyle, age, and natural proportions. Show them from knees up with room around the body for natural animation. ${STYLE_DIRECTION[style]} Gentle golden-hour backlight, cinematic composition, realistic photography. No text, logo, watermark, other people, celebrity likeness, or explicit content.`;
}

const MOTION_PROMPT =
  'The same person remains recognizable and alone on the sunset seaside pier. They take one slow natural step, turn slightly toward the horizon and smile softly. A gentle sea breeze moves their hair and clothing. Golden light shimmers across the water. Smooth subtle camera push-in, cinematic and realistic, stable face and anatomy, one continuous shot. No speaking, singing, lip sync, text or logos.';
const AMBIENT_AUDIO =
  ' Natural ambient sound only: soft waves, light wind and distant seagulls, no music or voices.';

type Info = {
  imageRequestId?: string;
  posterImageUrl?: string;
  duration?: Duration;
  quality?: Quality;
  audio?: boolean;
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
    // Until the HD scene lands, show the free poster it is re-rendering.
    sceneImageUrl: info.sceneImageUrl ?? info.posterImageUrl ?? null,
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
  if (!url || !url.startsWith('https://') || result?.persisted) return result;
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
      ? {
          ...result,
          persisted: true,
          video: { ...result.video, url: uploaded.url },
        }
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

function taskError(task: { error?: { message?: string } }, fallback: string) {
  return task.error?.message || fallback;
}

export async function advance(taskId: string, client: EvolinkClient) {
  let task = await findTask(taskId);
  if (!task) throw new Error('Task not found');
  const info = parseJson<Info>(task.taskInfo);
  try {
    if (task.status === AITaskStatus.PENDING && info.imageRequestId) {
      const image = await client.getTask(info.imageRequestId);
      if (image.status === 'failed')
        await fail(taskId, taskError(image, 'Scene generation failed'));
      else if (image.status === 'completed') {
        const sceneImageUrl = image.results?.[0];
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
            const video = await client.createVideo({
              model: VIDEO_MODEL,
              prompt: MOTION_PROMPT + (info.audio ? AMBIENT_AUDIO : ''),
              image_urls: [sceneImageUrl],
              duration: info.duration ?? DEFAULT_DURATION,
              quality: info.quality ?? DEFAULT_QUALITY,
              aspect_ratio: '9:16',
              generate_audio: info.audio === true,
            });
            await mergeTaskInfo(taskId, { videoRequestId: video.id });
          } catch (error: any) {
            await fail(taskId, error?.message || 'Video generation failed');
          }
        }
      }
    } else if (task.status === AITaskStatus.PROCESSING && info.videoRequestId) {
      const video = await client.getTask(info.videoRequestId);
      if (video.status === 'failed')
        await fail(taskId, taskError(video, 'Video generation failed'));
      else if (video.status === 'completed') {
        const url = video.results?.[0];
        if (!url) await fail(taskId, 'Video generation returned no video');
        else
          await updateTask({
            taskId,
            status: AITaskStatus.SUCCESS,
            taskResult: await persistVideo(taskId, { video: { url } }),
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

/**
 * Upload the visitor's photo and start the free poster at Seedream's lowest
 * resolution (1K); the paid video re-renders it at 2K first.
 */
export async function submitPoster(
  client: EvolinkClient,
  posterId: string,
  photo: string,
  style: Style
) {
  const ext = photo.slice(11, photo.indexOf(';'));
  const photoUrl = await client.uploadImage(
    photo,
    `${posterId}.${ext === 'jpeg' ? 'jpg' : ext}`
  );
  const image = await client.createImage({
    model: IMAGE_MODEL,
    prompt: scenePrompt(style),
    image_urls: [photoUrl],
    size: '9:16',
    quality: '1K',
    output_format: 'jpeg',
  });
  return { requestId: image.id, photoUrl };
}

const HD_SCENE_PROMPT =
  'Image 1 is the approved poster. Recreate it as the same single vertical 9:16 cinematic frame in higher resolution and finer detail: identical composition, framing, pose, outfit, scenery and golden-hour lighting. Image 2, when present, is the original photo: keep the face, identity, skin tone, hairstyle and age exactly as in it. Realistic photography. No text, logo, watermark or other people.';

/**
 * Paid step 1: re-render the free 1K poster at 2K. The task stays PENDING
 * until advance() sees the image and starts the Seedance video.
 */
export async function submitHdScene(
  client: EvolinkClient,
  poster: { imageUrl: string; photoUrl: string | null; createdAt: Date }
) {
  // Evolink keeps uploads for 72 h; past that, the poster alone is the reference.
  const photoFresh =
    !!poster.photoUrl &&
    Date.now() - new Date(poster.createdAt).getTime() < 70 * 60 * 60_000;
  const image = await client.createImage({
    model: IMAGE_MODEL,
    prompt: HD_SCENE_PROMPT,
    image_urls: photoFresh
      ? [poster.imageUrl, poster.photoUrl]
      : [poster.imageUrl],
    size: '9:16',
    quality: '2K',
    output_format: 'jpeg',
  });
  return image.id;
}

type PosterRow = NonNullable<Awaited<ReturnType<typeof findPoster>>>;

/** Evolink image links expire; keep posters on R2 when it is configured. */
async function persistPoster(posterId: string, url: string) {
  try {
    const storage = await getStorage();
    if (!storage) return url;
    const uploaded = await storage.downloadAndUpload({
      url,
      key: `everygen/posters/${posterId}.jpg`,
      contentType: 'image/jpeg',
      disposition: 'inline',
    });
    return uploaded.success && uploaded.url ? uploaded.url : url;
  } catch (error) {
    console.error('Everygen poster persistence failed', posterId, error);
    return url;
  }
}

/** Poll a pending poster once and settle it when Evolink is done. */
export async function advancePoster(row: PosterRow, client: EvolinkClient) {
  if (row.status !== PosterStatus.PENDING || !row.requestId) return;
  if (Date.now() - new Date(row.createdAt).getTime() > 30 * 60_000) {
    await claimPosterResult(row.id, {
      status: PosterStatus.FAILED,
      error: 'Poster generation timed out',
    });
    return;
  }
  try {
    const image = await client.getTask(row.requestId);
    if (image.status === 'failed') {
      await claimPosterResult(row.id, {
        status: PosterStatus.FAILED,
        error: taskError(image, 'Poster generation failed'),
      });
    } else if (image.status === 'completed') {
      const url = image.results?.[0];
      await claimPosterResult(
        row.id,
        url
          ? {
              status: PosterStatus.SUCCESS,
              imageUrl: await persistPoster(row.id, url),
            }
          : {
              status: PosterStatus.FAILED,
              error: 'Poster generation returned no image',
            }
      );
    }
  } catch (error: any) {
    if (!isTransient(error))
      await claimPosterResult(row.id, {
        status: PosterStatus.FAILED,
        error: error?.message || 'Poster generation failed',
      });
  }
}

export async function failTimedOut(taskId: string) {
  await fail(taskId, 'Generation timed out');
}
export async function failSubmission(taskId: string, message: string) {
  await fail(taskId, message);
}
