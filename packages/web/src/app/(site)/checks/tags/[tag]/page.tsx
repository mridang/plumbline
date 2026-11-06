import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { usedTags, TagView } from '@/components/checks/reference-views';
import { ChecksShell } from '@/components/checks/shell';
import { parseView, tagPath, type SearchParams } from '@/domain/checks/browse';

/** The dynamic part of the address: the tag. */
interface Props {
  readonly params: Promise<{ readonly tag: string }>;
  readonly searchParams: Promise<SearchParams>;
}

/** Every tag some rule carries has a page. */
export function generateStaticParams(): { tag: string }[] {
  return usedTags().map(({ tag }) => ({ tag }));
}

/** The page of a tag is named for it. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return pageMetadata({
    title: `Rules tagged ${tag}`,
    description: `Every Plumbline rule that carries the ${tag} tag, across areas.`,
    path: tagPath(tag),
    index: true,
  });
}

/** One tag: every rule that carries it. */
export default async function TagPage({
  params,
  searchParams,
}: Props): Promise<ReactElement> {
  const { tag } = await params;
  if (!usedTags().some((entry) => entry.tag === tag)) {
    notFound();
  }
  return (
    <ChecksShell here={{ kind: 'tags' }}>
      <TagView tag={tag} view={parseView(await searchParams)} />
    </ChecksShell>
  );
}
