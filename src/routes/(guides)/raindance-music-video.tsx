import { createFileRoute } from '@tanstack/react-router';

import * as guide from '@/content/guides/raindance-music-video.en.mdx';

import { guideRouteOptions } from './-guide-page';

export const Route = createFileRoute('/(guides)/raindance-music-video')(
  guideRouteOptions('/raindance-music-video', guide)
);
