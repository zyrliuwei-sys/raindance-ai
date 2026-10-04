import { createFileRoute, Outlet } from '@tanstack/react-router';

import { EverygenFooter, EverygenHeader } from '@/blocks/everygen';

export const Route = createFileRoute('/(guides)')({
  component: GuidesLayout,
});

function GuidesLayout() {
  return (
    <div className="eg-page flex min-h-screen flex-col">
      <EverygenHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <EverygenFooter />
    </div>
  );
}
