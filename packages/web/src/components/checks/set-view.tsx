import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui-app/badge';
import {
  Kicker,
  Label,
  Lead,
  PageTitle,
  Rich,
} from '@/components/checks/parts';
import {
  AreaFolds,
  SubsectionTable,
  hasManyTiers,
} from '@/components/checks/rule-table';
import { setTitle } from '@/components/checks/side-nav';
import { Toolbar } from '@/components/checks/toolbar';
import { CodeBlock } from '@/components/ui-app/code-block';
import { SECTIONS } from '@/domain/checks/catalogue';
import {
  areaPath,
  byArea,
  bySubsection,
  filterRules,
  rulesOfArea,
  rulesOfSet,
  setPath,
  tierCounts,
  yamlFor,
  type View,
} from '@/domain/checks/browse';
import { findRuleSet } from '@/domain/checks/sets';
import { countOf, formatCount } from '@/lib/intl';

/** The kicker over a set's title, by what kind of set it is. */
const KICKERS = {
  top: 'Rule set',
  section: 'Rule set · one area',
  profile: 'Rule set · audience',
} as const;

/** A rule set's page: what it is, how to use it, and every rule in it, grouped by area. */
export function SetView({
  id,
  view,
}: Readonly<{ id: string; view: View }>): ReactElement {
  const set = findRuleSet(id);
  const rules = rulesOfSet(id);
  const shown = filterRules(rules, view);
  const path = setPath(id);
  const tiers = tierCounts(rules);
  const parts = (['recommended', 'advanced', 'experimental'] as const)
    .filter((tier) => tiers[tier] > 0)
    .map((tier) => `${formatCount(tiers[tier])} ${tier}`)
    .join(' · ');
  const areas = byArea(rules);
  const many = hasManyTiers(rules);
  return (
    <>
      <Kicker>{KICKERS[set?.kind ?? 'top']}</Kicker>
      <PageTitle
        extra={
          id === 'plumbline:recommended' ? (
            <Badge tone="good">Default</Badge>
          ) : undefined
        }
      >
        {setTitle(id)}
      </PageTitle>
      <p className="mt-1 font-mono text-sm text-subtle">{id}</p>
      <Lead>
        <Rich text={set?.summary ?? set?.description ?? ''} />
        {set?.whenToUse ? (
          <>
            {' '}
            <Rich text={set.whenToUse} />
          </>
        ) : null}
      </Lead>

      <section className="mt-8 overflow-hidden rounded-card border border-line bg-surface">
        <div className="grid divide-y divide-line lg:grid-cols-[14rem_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
          <div className="p-6">
            <p className="font-display text-5xl leading-none font-semibold tracking-tight tabular-nums">
              {formatCount(rules.length)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {parts}
              {id === 'plumbline:recommended'
                ? ' · what you get with no file'
                : ''}
            </p>
          </div>
          <div className="p-6">
            <Label>Use it</Label>
            <div className="mt-2 max-w-md">
              <CodeBlock label={`Using ${id}`}>{yamlFor(id)}</CodeBlock>
            </div>
          </div>
        </div>
        <div className="border-t border-line bg-ink/3 px-6 py-4">
          <Label className="mb-2">By area</Label>
          <div className="flex flex-wrap gap-1.5">
            {areas.map(({ section, rules: inArea }) => (
              <Link
                key={section.id}
                href={areaPath(section.id)}
                className="focus-ring-flush inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-muted ring-1 ring-ink/10 ring-inset hover:bg-ink/6 hover:text-ink"
              >
                {section.title}{' '}
                <span className="text-xs text-subtle tabular-nums">
                  {inArea.length}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Every rule in this set
        </h2>
        {rules.length > 40 ? (
          <p className="mt-1 text-sm text-muted">
            Grouped by area. Open an area to read its rules.
          </p>
        ) : null}
      </div>
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
          foldedByDefault={rules.length > 40}
        />
      </div>
    </>
  );
}

/** An area's page: what it is about, its sets, and its rules by subsection. */
export function AreaView({
  id,
  view,
}: Readonly<{ id: string; view: View }>): ReactElement | null {
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) {
    return null;
  }
  const all = rulesOfArea(id);
  const shown = filterRules(all, view);
  const path = areaPath(id);
  const sets = ['recommended', 'advanced', 'experimental']
    .map((tier) => findRuleSet(`plumbline:${id}/${tier}`))
    .filter((set) => set && set.members.length > 0);
  const many = hasManyTiers(all);
  return (
    <>
      <Kicker>{section.group_title}</Kicker>
      <PageTitle
        extra={
          section.default_on ? undefined : <Badge tone="info">opt in</Badge>
        }
      >
        {section.title}
      </PageTitle>
      <Lead>{section.intro}</Lead>
      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-subtle">Fixed by</dt>
          <dd className="mt-0.5">{section.fixer}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Rule sets</dt>
          <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {sets.map((set) =>
              set ? (
                <Link
                  key={set.id}
                  className="font-mono text-xs text-accent hover:underline"
                  href={setPath(set.id)}
                >
                  {set.id.replace('plumbline:', '')} · {set.members.length}
                </Link>
              ) : null,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Area id</dt>
          <dd className="mt-0.5 font-mono text-xs">{section.id}</dd>
        </div>
      </dl>
      <p className="mt-4 max-w-2xl text-sm text-muted">{section.description}</p>
      <Toolbar
        path={path}
        view={view}
        shown={shown.length}
        total={all.length}
        showTier={many}
      />
      <div className="mt-4">
        <SubsectionTable
          groups={bySubsection(shown)}
          view={view}
          path={path}
          showTier={many}
        />
      </div>
      <p className="mt-6 text-sm text-subtle">
        {countOf(all.length, 'rule')} in this area.
      </p>
    </>
  );
}
