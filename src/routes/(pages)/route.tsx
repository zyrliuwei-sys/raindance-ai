import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MDXProvider } from '@mdx-js/react';

import { EverygenFooter, EverygenHeader } from '@/blocks/everygen';
import { mdxComponents } from '@/components/mdx-components';

export const Route = createFileRoute('/(pages)')({
  component: PagesLayout,
});

function PagesLayout() {
  return (
    <div className="eg-page flex min-h-screen flex-col">
      <EverygenHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-16 pb-24 sm:px-6 md:pt-24 md:pb-32">
        <MDXProvider components={mdxComponents}>
          <Outlet />
        </MDXProvider>
      </main>
      <EverygenFooter />
    </div>
  );
}
