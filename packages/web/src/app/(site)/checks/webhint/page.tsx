import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { WebhintView } from '@/components/checks/reference-views';
import { ChecksShell } from '@/components/checks/shell';

/** A public page: it may be indexed. */
export const metadata: Metadata = pageMetadata({
  title: 'Webhint stock hints',
  description:
    'The hints webhint ships and whether a Plumbline rule covers each one.',
  path: '/checks/webhint',
  index: true,
});

/** The webhint hints and how far Plumbline covers them. */
export default function WebhintPage(): ReactElement {
  return (
    <ChecksShell here={{ kind: 'webhint' }}>
      <WebhintView />
    </ChecksShell>
  );
}
