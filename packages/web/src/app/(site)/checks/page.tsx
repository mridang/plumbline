import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { ChecksShell } from '@/components/checks/shell';
import { Overview } from '@/components/checks/overview';

/** A public page: it may be indexed. */
export const metadata: Metadata = pageMetadata({
  title: 'Rules',
  description:
    'Every rule Plumbline checks a site with, in rule sets you can extend: security headers, HTTPS, privacy, SEO, link previews and more, with where each rule comes from.',
  path: '/checks',
  index: true,
});

/** The overview of the rules: the default rule set, the others and the areas. */
export default function ChecksPage(): ReactElement {
  return (
    <ChecksShell here={{ kind: 'overview' }}>
      <Overview />
    </ChecksShell>
  );
}
