import { createFileRoute } from '@tanstack/react-router';

import * as guide from '@/content/guides/genematic-alternative.en.mdx';

import { guideRouteOptions } from './-guide-page';

export const Route = createFileRoute('/(guides)/genematic-alternative')(
  guideRouteOptions('/genematic-alternative', guide)
);
