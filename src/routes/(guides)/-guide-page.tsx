import type { ComponentType, ReactNode } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { GUIDE_PATHS, type GuidePath } from '@/config/guides';
import { getLocale } from '@/paraglide/runtime.js';
import { JsonLd } from '@/blocks/everygen';

type GuideModule = {
  default: ComponentType<{ components?: Record<string, ComponentType<any>> }>;
  meta: {
    title: string;
    description: string;
    updated_at: string;
    h1?: string;
    kicker?: string;
    lede?: string;
  };
  faq?: { q: string; a: string }[];
};

const GUIDE_TITLES: Record<GuidePath, string> = {
  '/how-to-make-raindance-ai-video': 'How to make a Raindance AI video',
  '/raindance-ai-trend': 'The Raindance trend, explained',
  '/raindance-music-video': 'The Raindance music video look',
  '/raindance-meme': 'Raindance meme ideas',
  '/genematic-alternative': 'Genematic alternative for Raindance',
};

/** In-article call to action pointing at the homepage studio. */
function Cta({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <aside className="eg-guide-cta">
      <p className="eg-guide-cta-title">{title}</p>
      {children ? <div className="eg-guide-cta-body">{children}</div> : null}
      <a href="/#create" className="eg-button">
        Open the Raindance AI studio
        <ArrowRight size={17} />
      </a>
    </aside>
  );
}

/** Two-column comparison table (MDX has no GFM tables here). */
function Compare({
  headers,
  rows,
}: {
  headers: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="eg-compare" role="region" aria-label={headers.join(' vs ')}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compliance notice required on every guide. */
function Notice() {
  return (
    <aside className="eg-guide-notice">
      <p>
        <strong>Independent tool.</strong> Raindance AI is not affiliated with,
        endorsed by or connected to Dave, Tems or their record labels. We do not
        provide the song, the official music video or any music download.
      </p>
      <p>
        <strong>Your photo, your permission.</strong> Only upload photos of
        yourself or of people who have agreed to it.
      </p>
      <p>
        <strong>AI-generated content.</strong> Every clip made with Raindance AI
        is AI-generated, not real footage. Label it as AI content when you post.
      </p>
    </aside>
  );
}

const guideComponents = { Cta, Compare, Notice };

/**
 * Route options for an English-only SEO guide. The canonical always points
 * at the unprefixed English URL; locale-prefixed copies are noindexed so
 * they never compete with it.
 */
export function guideRouteOptions(path: GuidePath, mod: GuideModule) {
  const url = `${envConfigs.app_url}${path}`;
  return {
    loader: () => ({ locale: getLocale() }),
    head: ({ loaderData }: { loaderData?: { locale: string } }) => {
      const { title, description } = mod.meta;
      const translated = loaderData && loaderData.locale !== 'en';
      return {
        meta: [
          { title },
          { name: 'description', content: description },
          ...(translated
            ? [{ name: 'robots', content: 'noindex,follow' }]
            : []),
          { property: 'og:title', content: title },
          { property: 'og:description', content: description },
          { property: 'og:type', content: 'article' },
          { property: 'og:url', content: url },
          {
            property: 'og:image',
            content: `${envConfigs.app_url}/imgs/generated/everygen-dusk-pier-1791086124259.png`,
          },
          { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: url }],
      };
    },
    component: () => <GuidePage path={path} mod={mod} />,
  };
}

function GuidePage({ path, mod }: { path: GuidePath; mod: GuideModule }) {
  const { meta, faq = [] } = mod;
  const Body = mod.default;
  const url = `${envConfigs.app_url}${path}`;
  const related = GUIDE_PATHS.filter((p) => p !== path);
  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: meta.h1 ?? meta.title,
      description: meta.description,
      dateModified: meta.updated_at,
      mainEntityOfPage: url,
      inLanguage: 'en',
      publisher: { '@type': 'Organization', name: envConfigs.app_name },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: envConfigs.app_name,
          item: `${envConfigs.app_url}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: meta.h1 ?? meta.title,
          item: url,
        },
      ],
    },
    ...(faq.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          },
        ]
      : []),
  ];

  return (
    <article className="eg-article" lang="en">
      <header className="eg-article-head eg-shell">
        <nav className="eg-crumbs" aria-label="Breadcrumb">
          <Link href="/">{envConfigs.app_name}</Link>
          <span aria-hidden="true">/</span>
          <span>{meta.kicker ?? 'Guide'}</span>
        </nav>
        <h1>{meta.h1 ?? meta.title}</h1>
        {meta.lede ? <p className="eg-article-lede">{meta.lede}</p> : null}
        <p className="eg-article-meta">Updated {meta.updated_at}</p>
      </header>
      <div className="eg-article-body eg-shell">
        <MDXProvider components={guideComponents}>
          <Body />
        </MDXProvider>
        {faq.length > 0 && (
          <section className="eg-article-faq" aria-labelledby="guide-faq">
            <h2 id="guide-faq">Questions people ask</h2>
            {faq.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        )}
        <Notice />
        <nav className="eg-article-related" aria-label="More guides">
          <p>More Raindance guides</p>
          <ul>
            <li>
              <Link href="/">Raindance AI Video Generator</Link>
            </li>
            {related.map((p) => (
              <li key={p}>
                <Link href={p}>{GUIDE_TITLES[p]}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <JsonLd data={structured} />
    </article>
  );
}
