/**
 * Public SEO guide pages (English only, src/routes/(guides)/). Shared by the
 * site footer and the sitemap so a new guide only needs adding here once.
 */
export const GUIDE_PATHS = [
  '/how-to-make-raindance-ai-video',
  '/raindance-ai-trend',
  '/raindance-music-video',
  '/raindance-meme',
  '/genematic-alternative',
] as const;

export type GuidePath = (typeof GUIDE_PATHS)[number];
