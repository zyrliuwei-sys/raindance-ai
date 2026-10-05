import { createFileRoute } from '@tanstack/react-router';

import {
  DURATIONS,
  everygenCredits,
  isOffered,
  QUALITIES,
} from '@/config/everygen-pricing';
import { respData } from '@/lib/resp';

// Credits for every duration × resolution, e.g. { "5-720p": 481 }.
async function GET() {
  const prices: Record<string, number> = {};
  for (const duration of DURATIONS)
    for (const quality of QUALITIES)
      if (isOffered(duration, quality))
        prices[`${duration}-${quality}`] = everygenCredits(duration, quality);
  return respData({ credits: everygenCredits(), prices });
}

export const Route = createFileRoute('/api/everygen/price')({
  server: { handlers: { GET } },
});
