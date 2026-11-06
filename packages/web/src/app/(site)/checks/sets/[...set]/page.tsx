import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { setTitle } from '@/components/checks/side-nav';
import { SetView } from '@/components/checks/set-view';
import { ChecksShell } from '@/components/checks/shell';
import {
  parseView,
  setOfSegments,
  setPath,
  type SearchParams,
} from '@/domain/checks/browse';
import { RULE_SET_DEFS } from '@/domain/checks/sets';

/** The dynamic part of the address: `seo/advanced` for `plumbline:seo/advanced`. */
interface Props {
  readonly params: Promise<{ readonly set: string[] }>;
  readonly searchParams: Promise<SearchParams>;
}

/** Every rule set has a page. */
export function generateStaticParams(): { set: string[] }[] {
  return RULE_SET_DEFS.map((set) => ({
    set: set.id.replace(/^plumbline:/, '').split('/'),
  }));
}

/** The page of a rule set is named for it. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = setOfSegments((await params).set);
  if (!id) {
    return {};
  }
  return pageMetadata({
    title: `${setTitle(id)} rules`,
    description: `Every rule in ${id} and how to turn it on in plumbline.yaml.`,
    path: setPath(id),
    index: true,
  });
}

/** One rule set: what it is, how to use it and every rule in it. */
export default async function SetPage({
  params,
  searchParams,
}: Props): Promise<ReactElement> {
  const id = setOfSegments((await params).set);
  if (!id) {
    notFound();
  }
  return (
    <ChecksShell here={{ kind: 'set', id }}>
      <SetView id={id} view={parseView(await searchParams)} />
    </ChecksShell>
  );
}
