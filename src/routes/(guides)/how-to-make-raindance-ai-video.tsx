import { createFileRoute } from '@tanstack/react-router';

import * as guide from '@/content/guides/how-to-make-raindance-ai-video.en.mdx';

import { guideRouteOptions } from './-guide-page';

export const Route = createFileRoute(
  '/(guides)/how-to-make-raindance-ai-video'
)(guideRouteOptions('/how-to-make-raindance-ai-video', guide));
