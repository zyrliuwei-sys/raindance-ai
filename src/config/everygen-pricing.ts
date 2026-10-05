/**
 * Raindance video pricing (client-safe, no server imports).
 *
 * 1 site credit = 1 Evolink credit (≈ $0.0147). Each video is charged 7× its
 * Evolink list cost, rounded up to a whole credit:
 *   scene   = Seedream 5.0 Flash, 1.1016 credits per image
 *   video   = Seedance 2.0 image-to-video, per output second by resolution
 * Source: evolink.ai/seedream-5-0-flash and evolink.ai/seedance-2-0 (2026-10-05).
 */

export const SCENE_CREDITS = 1.1016;
export const VIDEO_CREDITS_PER_SECOND = {
  '480p': 6.2775,
  '720p': 13.5,
  '1080p': 33.75,
} as const;
export const PRICE_MARKUP = 7;

export const DURATIONS = [5, 10, 15] as const;
export const QUALITIES = ['480p', '720p', '1080p'] as const;
export type Duration = (typeof DURATIONS)[number];
export type Quality = (typeof QUALITIES)[number];

export const DEFAULT_DURATION: Duration = 5;
export const DEFAULT_QUALITY: Quality = '720p';

export function everygenCredits(
  duration: Duration = DEFAULT_DURATION,
  quality: Quality = DEFAULT_QUALITY
) {
  const cost = SCENE_CREDITS + VIDEO_CREDITS_PER_SECOND[quality] * duration;
  // toFixed strips float noise before rounding up to a whole credit.
  return Math.ceil(Number((cost * PRICE_MARKUP).toFixed(6)));
}

/** Price of the default (5 s, 720p) video, used for "≈ N videos" copy. */
export const EVERYGEN_CREDITS = everygenCredits();
