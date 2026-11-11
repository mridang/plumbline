import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { Badge } from '@/components/ui-app/badge';
import { Chevron, Chip, Label, TierBadge } from '@/components/checks/parts';
import { cn } from '@/components/ui/cn';
import {
  CONTROL_INFO,
  SECTIONS,
  type Check,
  type Section,
} from '@/domain/checks/catalogue';
import {
  areaPath,
  formatMonth,
  queryOf,
  selectorsFor,
  tagPath,
  topicTags,
  type View,
} from '@/domain/checks/browse';

/** Where a table's links stay, and how it is shown. */
interface Context {
  readonly view: View;
  /** The page the links stay on. */
  readonly path: string;
  /** The tier column is left out when every rule has the same tier. */
  readonly showTier: boolean;
}

/** Whether a list holds more than one tier, so the tier column says something. */
export function hasManyTiers(rules: readonly Check[]): boolean {
  return new Set(rules.map((check) => check.tier)).size > 1;
}

/** The column heads of a table of rules. */
function Head({
  second,
  showTier,
}: Readonly<{ second: string; showTier: boolean }>): ReactElement {
  const cols = ['Rule', ...(showTier ? ['Tier'] : []), second, 'Fixed by', ''];
  return (
    <thead className="border-b border-line text-subtle">
      <tr>
        {cols.map((col, index) => (
          <th
            key={`${index}:${col}`}
            scope="col"
            className={cn(
              'px-4 py-3 text-left text-xs font-medium whitespace-nowrap',
              col === '' && 'w-10',
            )}
          >
            {col === '' ? <span className="sr-only">Details</span> : col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** A label above a piece of text, in the open row of a rule. */
function Fact({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>): ReactElement {
  return (
    <div>
      <dt>
        <Label>{label}</Label>
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

/** What the open row of a rule says: what and how to fix on the left, the facts on the right. */
function Detail({
  check,
  columns,
}: Readonly<{ check: Check; columns: number }>): ReactElement {
  const control = CONTROL_INFO.find((c) => c.id === check.control);
  const fix = check.how_to_fix;
  const tags = topicTags(check);
  return (
    <tr className="bg-ink/3">
      <td colSpan={columns} className="px-4 pt-1 pb-6">
        <div className="grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-4 text-sm">
            <dl className="space-y-4">
              <Fact label="What it checks">
                <span className="block max-w-prose text-pretty">
                  {check.description}
                </span>
              </Fact>
              {fix ? (
                <Fact label="How to fix it">
                  <span className="block max-w-prose text-pretty">
                    {fix.fix}
                  </span>
                </Fact>
              ) : null}
              {fix?.vercel || fix?.cloudflare ? (
                <div className="grid max-w-prose gap-3 sm:grid-cols-2">
                  {fix.vercel ? (
                    <Fact label="On Vercel">
                      <span className="text-muted">{fix.vercel}</span>
                    </Fact>
                  ) : null}
                  {fix.cloudflare ? (
                    <Fact label="On Cloudflare">
                      <span className="text-muted">{fix.cloudflare}</span>
                    </Fact>
                  ) : null}
                </div>
              ) : null}
              {check.note ? (
                <Fact label="Note">
                  <span className="text-muted">{check.note}</span>
                </Fact>
              ) : null}
            </dl>
          </div>
          <dl className="space-y-4 text-sm">
            <Fact label="Fixed by">
              <b className="font-medium">{check.control}</b>{' '}
              <span className="text-muted">{control?.description}</span>
            </Fact>
            <Fact label="Adapted from">
              <ul className="space-y-0.5">
                {check.origins.length > 0 ? (
                  check.origins.map((origin) => (
                    <li key={`${origin.source}:${origin.url}`}>
                      <a
                        className="text-accent underline-offset-2 hover:underline"
                        href={origin.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {origin.title || origin.source}
                      </a>{' '}
                      <span className="text-subtle">· {origin.source}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-subtle">Written for Plumbline</li>
                )}
              </ul>
            </Fact>
            <Fact label="Added">
              {formatMonth(check.added)}{' '}
              <span className="font-mono text-xs text-subtle">
                catalogue v{check.since}
              </span>
            </Fact>
            {tags.length > 0 ? (
              <Fact label="Goals">
                <span className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Chip key={tag} href={tagPath(tag)}>
                      {tag}
                    </Chip>
                  ))}
                </span>
              </Fact>
            ) : null}
            <Fact label="Selectors">
              <span className="font-mono text-xs wrap-break-word text-muted">
                {selectorsFor(check).join(' ')}
              </span>
            </Fact>
          </dl>
        </div>
      </td>
    </tr>
  );
}

/** One rule: its row, and under it the open detail when the address asks for it. */
function RuleRow({
  check,
  home,
  context,
}: Readonly<{
  check: Check;
  /** Show the rule's area in place of its subsection. */
  home: boolean;
  context: Context;
}>): ReactElement {
  const { view, path, showTier } = context;
  const open = view.rule === check.id;
  const href = `${path}${queryOf(view, { rule: open ? undefined : check.id })}#rule-${check.id}`;
  const section = SECTIONS.find((s) => s.id === check.section);
  return (
    <>
      <tr
        id={`rule-${check.id}`}
        className={cn(
          'scroll-mt-24 motion-safe:transition-colors',
          open ? 'bg-ink/3' : 'hover:bg-ink/3',
        )}
      >
        <td className="px-4 py-3">
          <Link
            href={href}
            scroll={false}
            aria-expanded={open}
            className="focus-ring-flush block rounded-control"
          >
            <span className="block font-medium text-ink">{check.name}</span>
            <span className="mt-0.5 block font-mono text-xs text-subtle">
              {check.id}
            </span>
          </Link>
        </td>
        {showTier ? (
          <td className="px-4 py-3 whitespace-nowrap">
            <TierBadge tier={check.tier} />
          </td>
        ) : null}
        <td className="px-4 py-3 text-sm text-muted">
          {home ? (
            <Link
              className="hover:text-ink hover:underline"
              href={areaPath(check.section)}
            >
              {section?.title ?? check.section}
            </Link>
          ) : (
            check.subsection
          )}
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-muted">
          {check.control}
        </td>
        <td className="px-4 py-3 text-right">
          <Link
            href={href}
            scroll={false}
            tabIndex={-1}
            aria-hidden="true"
            className="inline-block"
          >
            <Chevron className={open ? 'rotate-90' : ''} />
          </Link>
        </td>
      </tr>
      {open ? <Detail check={check} columns={showTier ? 5 : 4} /> : null}
    </>
  );
}

/** What a list says when nothing is left after the filter. */
function Nothing(): ReactElement {
  return (
    <div className="rounded-card border border-dashed border-field/60 bg-surface px-6 py-10 text-center text-sm text-muted">
      No rule matches.
    </div>
  );
}

/**
 * The rules of an area in one table, with a band for each subsection.
 */
export function SubsectionTable({
  groups,
  view,
  path,
  showTier,
}: Readonly<{
  groups: readonly { subsection: string; rules: readonly Check[] }[];
  view: View;
  path: string;
  showTier: boolean;
}>): ReactElement {
  if (groups.length === 0) {
    return <Nothing />;
  }
  const context = { view, path, showTier };
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-160 text-left text-sm">
        <caption className="sr-only">Rules by subsection</caption>
        <Head second="Subsection" showTier={showTier} />
        <tbody className="divide-y divide-line">
          {groups.map(({ subsection, rules }) => (
            <SubsectionBand
              key={subsection}
              name={subsection}
              rules={rules}
              context={context}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A band naming a subsection, then its rules. */
function SubsectionBand({
  name,
  rules,
  context,
}: Readonly<{
  name: string;
  rules: readonly Check[];
  context: Context;
}>): ReactElement {
  return (
    <>
      <tr className="bg-ink/3">
        <td
          colSpan={context.showTier ? 5 : 4}
          className="px-4 py-2 text-label font-semibold tracking-[0.16em] text-subtle uppercase"
        >
          {name} · {rules.length}
        </td>
      </tr>
      {rules.map((check) => (
        <RuleRow key={check.id} check={check} home={false} context={context} />
      ))}
    </>
  );
}

/**
 * Rules grouped by area, each area a fold that opens without a script. A long
 * list starts folded unless the address (`?open=all`), a filter or an open
 * rule says otherwise.
 */
export function AreaFolds({
  groups,
  view,
  path,
  showTier,
  foldedByDefault,
}: Readonly<{
  groups: readonly { section: Section; rules: readonly Check[] }[];
  view: View;
  path: string;
  showTier: boolean;
  foldedByDefault: boolean;
}>): ReactElement {
  if (groups.length === 0) {
    return <Nothing />;
  }
  const context = { view, path, showTier };
  const filtered = view.q !== '' || view.tier !== undefined;
  const open = (entry: { rules: readonly Check[] }): boolean => {
    if (view.open === 'all') {
      return true;
    }
    if (view.open === 'none') {
      return false;
    }
    return (
      !foldedByDefault ||
      filtered ||
      entry.rules.some((check) => check.id === view.rule)
    );
  };
  return (
    <div className="space-y-3">
      {groups.map((entry) => (
        <details
          key={entry.section.id}
          open={open(entry)}
          className="group/s overflow-hidden rounded-card border border-line bg-surface"
        >
          <summary className="focus-ring-flush flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-ink/3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              <Chevron className="group-open/s:rotate-90" />
              <span className="text-sm font-semibold">
                {entry.section.title}
              </span>
              {entry.section.default_on ? null : (
                <Badge tone="info">opt in</Badge>
              )}
            </span>
            <span className="text-sm text-subtle tabular-nums">
              {entry.rules.length}
            </span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-160 text-left text-sm">
              <caption className="sr-only">
                Rules in {entry.section.title}
              </caption>
              <Head second="Subsection" showTier={showTier} />
              <tbody className="divide-y divide-line">
                {entry.rules.map((check) => (
                  <RuleRow
                    key={check.id}
                    check={check}
                    home={false}
                    context={context}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
