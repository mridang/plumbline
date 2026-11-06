import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { AreaView } from '@/components/checks/set-view';
import { ChecksShell } from '@/components/checks/shell';
import { SECTIONS } from '@/domain/checks/catalogue';
import { areaPath, parseView, type SearchParams } from '@/domain/checks/browse';

/** The dynamic part of the address: the area's id. */
interface Props {
  readonly params: Promise<{ readonly section: string }>;
  readonly searchParams: Promise<SearchParams>;
}

/** Every area has a page. */
export function generateStaticParams(): { section: string }[] {
  return SECTIONS.map((section) => ({ section: section.id }));
}

/** The page of an area is named for it. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: id } = await params;
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) {
    return {};
  }
  return pageMetadata({
    title: `${section.title} rules`,
    description: section.intro,
    path: areaPath(section.id),
    index: true,
  });
}

/** One area: what it is about and its rules by subsection. */
export default async function AreaPage({
  params,
  searchParams,
}: Props): Promise<ReactElement> {
  const id = (await params).section;
  if (!SECTIONS.some((section) => section.id === id)) {
    notFound();
  }
  return (
    <ChecksShell here={{ kind: 'area', id }}>
      <AreaView id={id} view={parseView(await searchParams)} />
    </ChecksShell>
  );
}
