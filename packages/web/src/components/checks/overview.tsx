import Link from 'next/link';
import type { ReactElement } from 'react';

import {
  Arrow,
  BTN_GHOST,
  BTN_PRIMARY,
  Code,
  Kicker,
  Label,
  Lead,
  PageTitle,
  PartTitle,
  Rich,
} from '@/components/checks/parts';
import { setTitle } from '@/components/checks/side-nav';
import { Badge } from '@/components/ui-app/badge';
import { CodeBlock } from '@/components/ui-app/code-block';
import {
  CHECKS,
  DISPLAY_GROUPS,
  INTRO,
  SECTIONS,
  SET_INFOS,
  type Section,
} from '@/domain/checks/catalogue';
import { areaPath, setPath } from '@/domain/checks/browse';
import { findRuleSet } from '@/domain/checks/sets';
import { countOf, formatCount } from '@/lib/intl';

/** The default rule set's name. */
const DEFAULT = 'plumbline:recommended';

/** A row of the list of other sets. */
function OtherSet({ id }: Readonly<{ id: string }>): ReactElement {
  const set = findRuleSet(id);
  return (
    <Link
      href={setPath(id)}
      className="group focus-ring-flush flex items-center gap-4 px-5 py-4 hover:bg-ink/3 motion-safe:transition"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {setTitle(id)}{' '}
          <span className="ml-1 font-mono text-xs font-normal text-subtle">
            {id}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-pretty text-muted">
          {set?.summary ?? set?.description}
        </p>
      </div>
      <span className="shrink-0 text-sm text-subtle tabular-nums">
        {countOf(set?.members.length ?? 0, 'rule')}
      </span>
      <span className="shrink-0 text-subtle">
        <Arrow />
      </span>
    </Link>
  );
}

/** A row of the add-ons: an area that is off until asked for. */
function AddOn({ section }: Readonly<{ section: Section }>): ReactElement {
  const id = `plumbline:${section.id}/recommended`;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-semibold">{section.title}</p>
        <p className="mt-0.5 text-sm text-pretty text-muted">{section.intro}</p>
      </div>
      <code className="rounded-control bg-ink/6 px-2 py-1 font-mono text-xs">
        {id}
      </code>
      <Link
        className="group text-sm font-medium text-accent hover:underline"
        href={setPath(id)}
      >
        {countOf(findRuleSet(id)?.members.length ?? 0, 'rule')} <Arrow />
      </Link>
    </div>
  );
}

/** The steps of using a rule set. */
const STEPS: readonly { title: string; body: ReactElement }[] = [
  {
    title: 'Pick a rule set',
    body: (
      <>
        A rule set is a named list of rules. Most sites start with{' '}
        <Code>plumbline:recommended</Code>.
      </>
    ),
  },
  {
    title: 'Add what you need',
    body: (
      <>
        Opt into whole areas such as email in one line, or take the stricter
        advanced set.
      </>
    ),
  },
  {
    title: 'Tune single rules',
    body: (
      <>
        Turn one rule off, or set it to warn or error, under <Code>rules</Code>.
        The most specific line wins.
      </>
    ),
  },
];

/** The overview of the rules: what they are, where to start, what else there is. */
export function Overview(): ReactElement {
  const recommended = findRuleSet(DEFAULT);
  const others = SET_INFOS.filter(
    (set) => set.kind === 'top' && set.id !== DEFAULT,
  );
  const addOns = SECTIONS.filter(
    (section) =>
      !section.default_on && findRuleSet(`plumbline:${section.id}/recommended`),
  );
  const count = recommended?.members.length ?? 0;
  return (
    <>
      <Kicker>Rules</Kicker>
      <PageTitle>What Plumbline checks</PageTitle>
      <Lead>
        <Rich
          text={
            INTRO[0] ??
            `Plumbline runs ${countOf(CHECKS.length, 'check')}. A rule set decides which ones.`
          }
        />
      </Lead>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href={setPath(DEFAULT)} className={BTN_PRIMARY}>
          See the {formatCount(count)} recommended rules <Arrow />
        </Link>
        <Link href="#how" className={BTN_GHOST}>
          How rule sets work
        </Link>
      </div>

      <section className="mt-12 overflow-hidden rounded-card border border-line bg-surface">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <Badge tone="good">Default</Badge>
              <span className="font-mono text-xs text-subtle">{DEFAULT}</span>
            </div>
            <p className="mt-4 font-display text-6xl leading-none font-semibold tracking-tight tabular-nums">
              {formatCount(count)}
            </p>
            <p className="mt-2 text-base text-muted">
              rules, run on every site unless you say otherwise.
            </p>
            <p className="mt-4 max-w-md text-sm text-pretty text-muted">
              <Rich text={recommended?.summary ?? ''} />
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3 border-t border-line bg-ink/3 p-6 lg:border-t-0 lg:border-l">
            <Label>Use it</Label>
            <CodeBlock label="plumbline.yaml">
              {`# plumbline.yaml\nextends: ${DEFAULT}`}
            </CodeBlock>
            <p className="text-sm text-muted">
              No file at all gives you the same thing.
            </p>
          </div>
        </div>
      </section>

      <PartTitle
        title="Other rule sets"
        sub="Open one to read every rule in it."
      />
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {others.map((set) => (
          <OtherSet key={set.id} id={set.id} />
        ))}
      </div>

      {addOns.length > 0 ? (
        <>
          <PartTitle
            title="Add what you need"
            sub={
              <>
                These areas stay off until you ask for them. Add the line to
                your <Code>extends</Code> list.
              </>
            }
          />
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {addOns.map((section) => (
              <AddOn key={section.id} section={section} />
            ))}
          </div>
        </>
      ) : null}

      <section id="how" className="scroll-mt-24">
        <PartTitle title="How it fits together" />
        <ol className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="flex size-7 items-center justify-center rounded-full bg-ink/6 font-mono text-xs font-medium text-ink">
                {index + 1}
              </p>
              <p className="mt-3 text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-sm text-pretty text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <PartTitle
        title="Browse by area"
        sub="Every rule has exactly one area. Goals such as security or SEO are tags that cut across them."
      />
      {DISPLAY_GROUPS.map((group) => (
        <div key={group.id} className="mb-8">
          <Label className="mb-1 px-3">{group.title}</Label>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3">
            {group.sections.map((id) => {
              const section = SECTIONS.find((s) => s.id === id);
              return section ? (
                <Link
                  key={id}
                  href={areaPath(id)}
                  className="group focus-ring-flush rounded-control p-3 hover:bg-ink/4 motion-safe:transition"
                >
                  <p className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{section.title}</span>
                    <span className="text-xs font-normal text-subtle tabular-nums">
                      {CHECKS.filter((c) => c.section === id).length}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-pretty text-muted">
                    {section.intro}
                  </p>
                </Link>
              ) : null;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
