/**
 * Raindance free posters: anonymous seaside stills, limited per IP/device per
 * day plus a site-wide daily cap that bounds the Evolink bill.
 */

import { and, asc, count, eq, gte, ne } from 'drizzle-orm';

import { db } from '@/core/db';
import { everygenPoster, type EverygenPoster } from '@/config/db/schema';
import { getUuid } from '@/lib/hash';

export const PosterStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function since() {
  return new Date(Date.now() - DAY_MS);
}

/**
 * Posters this visitor started in the last 24h, counted per device and per
 * IP. Failed runs don't count, so a provider error never burns a free try.
 */
export async function countVisitorPosters(ipHash: string, deviceId: string) {
  const recent = (match: ReturnType<typeof eq>) =>
    db()
      .select({ n: count() })
      .from(everygenPoster)
      .where(
        and(
          gte(everygenPoster.createdAt, since()),
          ne(everygenPoster.status, PosterStatus.FAILED),
          match
        )
      );
  const [[byDevice], [byIp]] = await Promise.all([
    recent(eq(everygenPoster.deviceId, deviceId)),
    recent(eq(everygenPoster.ipHash, ipHash)),
  ]);
  return { device: Number(byDevice?.n ?? 0), ip: Number(byIp?.n ?? 0) };
}

/** Posters started site-wide in the last 24h (failed ones included). */
export async function countAllPosters() {
  const [row] = await db()
    .select({ n: count() })
    .from(everygenPoster)
    .where(gte(everygenPoster.createdAt, since()));
  return Number(row?.n ?? 0);
}

export async function createPoster(params: {
  ipHash: string;
  deviceId: string;
  userId?: string | null;
  style: string;
}): Promise<EverygenPoster> {
  const [row] = await db()
    .insert(everygenPoster)
    .values({
      id: getUuid(),
      ipHash: params.ipHash,
      deviceId: params.deviceId,
      userId: params.userId ?? null,
      status: PosterStatus.PENDING,
      style: params.style,
      createdAt: new Date(),
    })
    .returning();
  return row;
}

export async function findPoster(id: string) {
  const [row] = await db()
    .select()
    .from(everygenPoster)
    .where(eq(everygenPoster.id, id))
    .limit(1);
  return row as EverygenPoster | undefined;
}

export async function updatePoster(
  id: string,
  patch: Partial<
    Pick<
      EverygenPoster,
      'status' | 'requestId' | 'photoUrl' | 'imageUrl' | 'error'
    >
  >
) {
  await db().update(everygenPoster).set(patch).where(eq(everygenPoster.id, id));
}

/**
 * Settle a pending poster. Returns false when another request already did,
 * so the image is persisted once.
 */
export async function claimPosterResult(
  id: string,
  patch: Pick<EverygenPoster, 'status'> &
    Partial<Pick<EverygenPoster, 'imageUrl' | 'error'>>
) {
  const rows = await db()
    .update(everygenPoster)
    .set(patch)
    .where(
      and(
        eq(everygenPoster.id, id),
        eq(everygenPoster.status, PosterStatus.PENDING)
      )
    )
    .returning({ id: everygenPoster.id });
  return rows.length > 0;
}

/** Attach an anonymous poster to the user who animates it. */
export async function assignPosterUser(id: string, userId: string) {
  await db()
    .update(everygenPoster)
    .set({ userId })
    .where(eq(everygenPoster.id, id));
}

/** Pending posters, oldest first, for the background sweep. */
export async function listPendingPosters(limit = 20) {
  return db()
    .select()
    .from(everygenPoster)
    .where(eq(everygenPoster.status, PosterStatus.PENDING))
    .orderBy(asc(everygenPoster.createdAt))
    .limit(limit);
}
