import { createFileRoute } from '@tanstack/react-router';

import * as guide from '@/content/guides/raindance-ai-trend.en.mdx';

import { guideRouteOptions } from './-guide-page';

export const Route = createFileRoute('/(guides)/raindance-ai-trend')(
  guideRouteOptions('/raindance-ai-trend', guide)
);
