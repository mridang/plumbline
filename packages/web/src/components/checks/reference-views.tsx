import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui-app/badge';
import {
  Chip,
  Code,
  Kicker,
  Lead,
  PageTitle,
  PartTitle,
} from '@/components/checks/parts';
import { AreaFolds, hasManyTiers } from '@/components/checks/rule-table';
import { Toolbar } from '@/components/checks/toolbar';
import {
  CHECKS,
  CONTROL_INFO,
  TAGS,
  findCheck,
} from '@/domain/checks/catalogue';
import {
  OVERVIEW_PATH,
  areaPath,
  byArea,
  filterRules,
  rulesOfTag,
  tagPath,
  type View,
} from '@/domain/checks/browse';
import { STOCK_HINTS, type StockStatus } from '@/domain/checks/stock';
import type { Tone } from '@/components/ui-app/tone';
import { countOf, formatCount } from '@/lib/intl';

/** The tags that some rule carries, with how many. */
export function usedTags(): readonly { tag: string; count: number }[] {
  return TAGS.map((tag) => ({
    tag,
    count: CHECKS.filter((check) => check.tags.includes(tag)).length,
  })).filter((entry) => entry.count > 0);
}

/** The page of goals and tags, and of who fixes what. */
export function TagsView(): ReactElement {
  return (
    <>
      <Kicker>Reference</Kicker>
      <PageTitle>Goals and tags</PageTitle>
      <Lead>
        Each rule has one area and any number of tags for the goals it serves. A
        tag picks rules from several areas at once.
      </Lead>
      <div className="mt-8 flex flex-wrap gap-2">
        {usedTags().map(({ tag, count }) => (
          <Link
            key={tag}
            href={tagPath(tag)}
            className="focus-ring-flush inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 ring-ink/10 ring-inset hover:bg-ink/6"
          >
            {tag}
            <span className="text-xs text-subtle tabular-nums">{count}</span>
          </Link>
        ))}
      </div>
      <PartTitle
        title="Who fixes it"
        sub="Every rule says who can change the thing it checks."
      />
      <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {CONTROL_INFO.map((control) => (
          <div key={control.id}>
            <dt className="font-mono text-sm font-semibold">{control.id}</dt>
            <dd className="mt-1 text-sm text-pretty text-muted">
              {control.description}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** One tag's page: every rule that carries it, grouped by area. */
export function TagView({
  tag,
  view,
}: Readonly<{ tag: string; view: View }>): ReactElement {
  const rules = rulesOfTag(tag);
  const shown = filterRules(rules, view);
  const path = tagPath(tag);
  const many = hasManyTiers(rules);
  return (
    <>
      <Kicker>Tag</Kicker>
      <PageTitle>{tag}</PageTitle>
      <Lead>
        Every rule carrying this tag, across areas. In <Code>rules</Code> it is{' '}
        <Code>{`tag:${tag}`}</Code>.
      </Lead>
      <Toolbar
        path={path}
        view={view}
        shown={shown.length}
        total={rules.length}
        showTier={many}
        folds
      />
      <div className="mt-4">
        <AreaFolds
          groups={byArea(shown)}
          view={view}
          path={path}
          showTier={many}
          foldedByDefault={false}
        />
      </div>
    </>
  );
}

/** The tone of each coverage. */
const COVERAGE: Readonly<Record<StockStatus, Tone>> = {
  covered: 'good',
  partial: 'warn',
  'not covered': 'neutral',
};

/** The webhint hints and whether a Plumbline rule covers each. */
export function WebhintView(): ReactElement {
  const count = (status: StockStatus): number =>
    STOCK_HINTS.filter((hint) => hint.status === status).length;
  return (
    <>
      <Kicker>Reference</Kicker>
      <PageTitle>Webhint stock hints</PageTitle>
      <Lead>
        The {formatCount(STOCK_HINTS.length)} hints webhint ships, and whether a
        Plumbline rule covers each. Kept here so moving away from webhint later
        means filling these gaps.
      </Lead>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge tone="good">{count('covered')} covered</Badge>
        <Badge tone="warn">{count('partial')} partly covered</Badge>
        <Badge tone="neutral">{count('not covered')} not covered</Badge>
      </div>
      <div className="mt-6 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-176 text-left text-sm">
          <caption className="sr-only">Webhint stock hints</caption>
          <thead className="border-b border-line text-subtle">
            <tr>
              {['Hint', 'Category', 'Coverage', 'Plumbline rule', ''].map(
                (col, index) => (
                  <th
                    key={`${index}:${col}`}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap"
                  >
                    {col === '' ? <span className="sr-only">Docs</span> : col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {STOCK_HINTS.map((hint) => (
              <tr key={hint.id} className="hover:bg-ink/3">
                <td className="px-4 py-3">
                  <p className="font-medium">{hint.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-subtle">
                    {hint.id}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted">{hint.category}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge tone={COVERAGE[hint.status]}>{hint.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {hint.coveredBy.length > 0 ? (
                      hint.coveredBy.map((id) => (
                        <Chip
                          key={id}
                          href={areaPath(findCheck(id)?.section ?? 'seo')}
                        >
                          {id}
                        </Chip>
                      ))
                    ) : (
                      <span className="text-sm text-subtle">{hint.note}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <a
                    className="text-accent hover:underline"
                    href={hint.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Docs
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-subtle">
        {countOf(STOCK_HINTS.length, 'hint')} ·{' '}
        <Link className="text-accent hover:underline" href={OVERVIEW_PATH}>
          Back to the rules
        </Link>
      </p>
    </>
  );
}
