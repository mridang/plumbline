import { pageMetadata } from '@/app/_metadata';
import { TagsView } from '@/components/checks/reference-views';
import { ChecksShell } from '@/components/checks/shell';
import type { ReactElement } from 'react';
import type { Metadata } from 'next';

/** A public page: it may be indexed. */
export const metadata: Metadata = pageMetadata({
  title: 'Goals and tags',
  description:
    'The tags that cut across the areas of Plumbline rules, and who can fix what a rule finds.',
  path: '/checks/tags',
  index: true,
});

/** The goals and tags, and the meaning of who fixes it. */
export default function TagsPage(): ReactElement {
  return (
    <ChecksShell here={{ kind: 'tags' }}>
      <TagsView />
    </ChecksShell>
  );
}
