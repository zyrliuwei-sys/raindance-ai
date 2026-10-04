import { createFileRoute } from '@tanstack/react-router';

import { resolveEverygenCredits } from '@/config/everygen-pricing';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

async function GET() {
  try {
    return respData({
      credits: resolveEverygenCredits(await getAllConfigs()),
      duration: 5,
      audio: false,
    });
  } catch (error: any) {
    return respErr(error?.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/everygen/price')({
  server: { handlers: { GET } },
});
