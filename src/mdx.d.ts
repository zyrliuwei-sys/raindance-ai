declare module '*.mdx' {
  import type { ComponentType } from 'react';

  export const meta: {
    title: string;
    description: string;
    updated_at: string;
    /** Guide pages only: on-page H1, kicker and lede. */
    h1?: string;
    kicker?: string;
    lede?: string;
  };

  /** Guide pages only: visible FAQ, mirrored into FAQPage JSON-LD. */
  export const faq: { q: string; a: string }[] | undefined;

  const MDXComponent: ComponentType<{
    components?: Record<string, ComponentType<any>>;
  }>;
  export default MDXComponent;
}
