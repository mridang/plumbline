import type { ReactElement } from 'react';

import { BrandMark } from '@/components/site/logo';
import { Container } from '@/components/ui/layout';
import { BRAND_NAME } from '@/app/_brand';
import { SITE_URL, SOURCE_URL } from '@/utils/site';

/** A link in the footer. */
interface FooterLink {
  readonly label: string;
  readonly href: string;
}

/** The footer's columns: the product, the ways to run the checks, and the project. */
export const FOOTER_COLUMNS: readonly Readonly<{
  title: string;
  links: readonly FooterLink[];
}>[] = [
  {
    title: 'Product',
    links: [
      { label: 'Scan a site', href: '/#scan' },
      { label: 'What it checks', href: '/#checks' },
      { label: 'Your domains', href: '/domains' },
      { label: 'Connect an assistant', href: '/connect' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Command line', href: `${SOURCE_URL}/tree/master/packages/cli` },
      {
        label: 'Agent skill',
        href: `${SOURCE_URL}/tree/master/packages/skills`,
      },
      {
        label: 'webhint hints',
        href: `${SOURCE_URL}/tree/master/packages/hints`,
      },
      {
        label: 'Lighthouse plugin',
        href: `${SOURCE_URL}/tree/master/packages/lighthouse`,
      },
      {
        label: 'Docker image',
        href: `${SOURCE_URL}/tree/master/packages/docker`,
      },
      {
        label: 'REST API',
        href: `${SOURCE_URL}/blob/master/packages/web/openapi/plumbline.yaml`,
      },
      { label: 'MCP server', href: `${SITE_URL}/mcp` },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'Source on GitHub', href: SOURCE_URL },
      { label: 'Report an issue', href: `${SOURCE_URL}/issues` },
      { label: 'Security policy', href: '/security-policy.txt' },
      { label: 'For AI crawlers', href: '/llms.txt' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

/**
 * The foot of every page, on the same deep band as the hero: the mark and a
 * line on what plumbline is, three columns of links, and the small print.
 * Only pages anyone can open, and the documentation, belong here.
 */
export function SiteFooter(): ReactElement {
  return (
    <footer className="bg-night text-on-night">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <a
            href="/"
            className="focus-ring inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BrandMark className="size-6 text-glow" />
            {BRAND_NAME}
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-on-night/65">
            Website checks for security headers, TLS, DNS and email, privacy,
            SEO and AI-agent readiness, ported from the public references.
          </p>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="text-label font-semibold text-on-night/50 uppercase">
              {column.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="focus-ring text-on-night/80 transition hover:text-on-night"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-on-night/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-on-night/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {BRAND_NAME}. Open source under the Apache 2.0 licence.</p>
          <p>
            Built on{' '}
            <a href="https://webhint.io" className="focus-ring underline">
              webhint
            </a>
            . Nothing about a scan is stored.
          </p>
        </Container>
      </div>
    </footer>
  );
}
