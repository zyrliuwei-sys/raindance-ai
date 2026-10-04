import { createFileRoute, Outlet } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';

export const Route = createFileRoute('/(auth)')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] }),
  component: AuthLayout,
});

/** Brand print on the left (desktop only), the auth form on the right. */
function AuthLayout() {
  return (
    <div className="bg-background lg:grid lg:min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src="/imgs/generated/raindance-auth-cove.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="from-background via-background/40 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="absolute inset-x-12 bottom-14">
          <p className="font-serif text-5xl leading-[1.02] font-medium italic xl:text-6xl">
            {m['everygen.cta.title']()}
          </p>
          <p className="text-foreground/75 mt-4 max-w-sm">
            {m['everygen.cta.description']()}
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
