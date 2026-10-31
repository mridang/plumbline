import type { ReactElement } from 'react';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';

/** One area the checks cover, as the home page shows it. */
export interface CoverageArea {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Who usually makes the fixes in it. */
  readonly fixer: string;
  /** How many checks it holds. */
  readonly checks: number;
}

/**
 * What plumbline checks: one card per report section, with how many checks it
 * holds, what it covers and who usually fixes what it finds. Sections with no
 * checks are left out.
 */
export function Coverage({
  areas,
}: Readonly<{ areas: readonly CoverageArea[] }>): ReactElement {
  const shown = areas.filter((area) => area.checks > 0);
  return (
    <section
      id="checks"
      aria-labelledby="checks-heading"
      className="scroll-mt-20 py-24"
    >
      <Container className="max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>What it checks</Eyebrow>
          <h2
            id="checks-heading"
            className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
          >
            Everything a site serves, from the first byte to the last record
          </h2>
          <p className="mt-4 text-lg text-muted">
            Each check is ported from a public reference, with its rules,
            thresholds and wording kept, so a failure here is a failure there.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((area) => (
            <li
              key={area.id}
              className="flex flex-col rounded-card border border-line bg-surface p-6 transition hover:border-brand/40 hover:shadow-[0_12px_32px_-16px_rgb(11_10_31/0.25)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Heading as="h3" variant="h3" className="text-lg">
                  {area.title}
                </Heading>
                <span className="shrink-0 rounded-full bg-brand/8 px-2.5 py-0.5 text-xs font-semibold text-brand tabular-nums">
                  {area.checks} {area.checks === 1 ? 'check' : 'checks'}
                </span>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted">
                {area.description}
              </p>
              <p className="mt-auto pt-4 text-xs text-subtle">
                <span className="font-semibold">Fixed in:</span> {area.fixer}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
