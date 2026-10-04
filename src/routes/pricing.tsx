import { createFileRoute, redirect } from '@tanstack/react-router';

import { PRICING_ENABLED } from '@/config/pricing';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { EverygenFooter, EverygenHeader } from '@/blocks/everygen';
import { Pricing } from '@/blocks/pricing';

export const Route = createFileRoute('/pricing')({
  beforeLoad: () => {
    if (!PRICING_ENABLED) throw redirect({ to: '/' });
  },
  loader: () => {
    const locale = getLocale();
    return {
      title: m['landing.pricing.title']({}, { locale }),
      description: m['landing.pricing.description']({}, { locale }),
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          { name: 'description', content: loaderData.description },
          { name: 'robots', content: 'noindex,follow' },
        ]
      : [],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="eg-page bg-background text-foreground flex min-h-screen flex-col">
      <EverygenHeader />
      <main className="flex-1">
        <Pricing />
      </main>
      <EverygenFooter />
    </div>
  );
}
