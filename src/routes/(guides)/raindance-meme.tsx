import { createFileRoute } from '@tanstack/react-router';

import * as guide from '@/content/guides/raindance-meme.en.mdx';

import { guideRouteOptions } from './-guide-page';

export const Route = createFileRoute('/(guides)/raindance-meme')(
  guideRouteOptions('/raindance-meme', guide)
);
