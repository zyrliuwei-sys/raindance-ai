import { createFileRoute } from '@tanstack/react-router';

import { EvolinkClient } from '@/core/ai/evolink';
import { getAuth } from '@/core/auth';
import { everygenCredits } from '@/config/everygen-pricing';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance } from '@/modules/credits/service';
import {
  countAllPosters,
  countVisitorPosters,
  createPoster,
  findPoster,
  PosterStatus,
  updatePoster,
} from '@/modules/everygen-poster/service';
import { hasPermission } from '@/modules/rbac/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

import {
  deviceCookie,
  FREE_PREVIEW_PAUSED,
  FREE_PREVIEW_USED,
  visitor,
} from '../hotel-lobby/-preview';
import {
  advancePoster,
  parsePhotoInput,
  readInput,
  submitPoster,
} from './-pipeline';

type PosterRow = NonNullable<Awaited<ReturnType<typeof findPoster>>>;

// ~$0.017 each. Admin settings everygen_free_poster_cap /
// everygen_free_poster_per_visitor tune them; 0 switches free posters off.
const DEFAULT_DAILY_CAP = 300;
const DEFAULT_PER_VISITOR = 1;
// Many real visitors share one IP (mobile NAT, offices), so an IP gets a few
// visitors' worth before it is cut off.
const IP_SHARE = 5;

function readNumber(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function posterView(row: PosterRow) {
  return {
    id: row.id,
    status: row.status as 'pending' | 'success' | 'failed',
    style: row.style,
    imageUrl: row.status === PosterStatus.SUCCESS ? row.imageUrl : null,
    error: row.error,
  };
}

function client(configs: Record<string, string>) {
  return new EvolinkClient({
    apiKey: configs.evolink_api_key,
    baseUrl: configs.evolink_base_url,
  });
}

/**
 * Free posters left today. Admins and signed-in users who can already pay for
 * a video are not limited — their poster leads straight to a paid video.
 */
async function freeLeft(
  request: Request,
  configs: Record<string, string>,
  ids: { ipHash: string; deviceId: string }
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  if (!configs.evolink_api_key)
    return { userId, left: 0, reason: FREE_PREVIEW_PAUSED };
  if (
    userId &&
    ((await hasPermission(userId, 'admin.*')) ||
      (await getBalance(userId)) >= everygenCredits(5, '480p'))
  )
    return { userId, left: 1, reason: null };
  const dailyCap = readNumber(
    configs.everygen_free_poster_cap,
    DEFAULT_DAILY_CAP
  );
  const perVisitor = readNumber(
    configs.everygen_free_poster_per_visitor,
    DEFAULT_PER_VISITOR
  );
  if (!dailyCap || !perVisitor || (await countAllPosters()) >= dailyCap)
    return { userId, left: 0, reason: FREE_PREVIEW_PAUSED };
  const used = await countVisitorPosters(ids.ipHash, ids.deviceId);
  const left = Math.max(
    0,
    Math.min(perVisitor - used.device, perVisitor * IP_SHARE - used.ip)
  );
  return { userId, left, reason: left ? null : FREE_PREVIEW_USED };
}

function withDevice(
  response: Response,
  ids: { deviceId: string; isNewDevice: boolean },
  request: Request
) {
  if (ids.isNewDevice)
    response.headers.append('Set-Cookie', deviceCookie(ids.deviceId, request));
  return response;
}

// GET ?id=… polls a poster; without an id it reports today's free quota.
async function GET({ request }: { request: Request }) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const configs = await getAllConfigs();
    if (!id) {
      const ids = visitor(request);
      const { left, reason } = await freeLeft(request, configs, ids);
      return withDevice(respData({ left, reason }), ids, request);
    }
    let row = await findPoster(id);
    if (!row) return respErr('Poster not found');
    if (row.status === PosterStatus.PENDING && configs.evolink_api_key) {
      await advancePoster(row, client(configs));
      row = (await findPoster(id))!;
    }
    return respData(posterView(row));
  } catch (error: any) {
    return respErr(error?.message || 'Query failed');
  }
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 10_000,
    keyPrefix: 'everygen-poster',
  });
  if (limited) return limited;
  try {
    const body = await readInput(request);
    if ((body as any)?.consent !== true)
      return respErr('Photo consent is required');
    const input = parsePhotoInput(body);
    if (!input)
      return respErr('A JPG, PNG or WebP portrait under 6 MB is required');
    const configs = await getAllConfigs();
    const ids = visitor(request);
    const quota = await freeLeft(request, configs, ids);
    if (!quota.left) return withDevice(respErr(quota.reason!), ids, request);

    const row = await createPoster({
      ipHash: ids.ipHash,
      deviceId: ids.deviceId,
      userId: quota.userId,
      style: input.style,
    });
    try {
      const { requestId, photoUrl } = await submitPoster(
        client(configs),
        row.id,
        input.photo,
        input.style
      );
      await updatePoster(row.id, { requestId, photoUrl });
    } catch (error) {
      console.error('Everygen poster submission failed', row.id, error);
      await updatePoster(row.id, {
        status: PosterStatus.FAILED,
        error: 'Poster submission failed',
      });
      return respErr('Poster submission failed');
    }
    return withDevice(respData(posterView(row)), ids, request);
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'Photo is too large',
        'Photo is required',
        'Invalid photo request',
      ].includes(error.message)
    )
      return respErr(error.message);
    console.error('Everygen poster failed', error);
    return respErr('Poster failed');
  }
}

export const Route = createFileRoute('/api/everygen/poster')({
  server: { handlers: { GET, POST } },
});
