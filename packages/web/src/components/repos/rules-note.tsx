import Link from 'next/link';
import type { ReactElement } from 'react';

import { countOf } from '@/lib/intl';

/** Where the schema of `plumbline.yaml` is served (see `schemas/plumbline.schema.json`). */
const SCHEMA_PATH = '/schemas/plumbline.schema.json';

/**
 * A calm note on which checks a repository's results cover and how to change
 * that: only the checks its rules turn on are run and shown, and the rules are
 * a `plumbline.yaml` committed to the repository (the `plumbline:recommended`
 * rule set when there is none). It names no colour of failure, since nothing
 * here failed.
 */
export function RulesNote({
  repo,
  checks,
}: Readonly<{
  /** `owner/name` of the repository whose rules apply. */
  repo: string;
  /** How many checks the results shown cover, when a report is shown. */
  checks?: number;
}>): ReactElement {
  return (
    <aside
      aria-label="Rules"
      className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-pretty text-muted shadow-xs"
    >
      <h3 className="text-label font-semibold text-subtle uppercase">Rules</h3>
      <p className="mt-1.5 max-w-3xl">
        {checks === undefined
          ? 'Only the checks your rules turn on are shown. '
          : `These results cover the ${countOf(checks, 'check')} your rules turn on. `}
        They come from the <code className="font-mono">plumbline.yaml</code> in{' '}
        {repo}, or from <code className="font-mono">plumbline:recommended</code>{' '}
        when it has none. To check more, commit a{' '}
        <code className="font-mono">plumbline.yaml</code> that extends a rule
        set such as <code className="font-mono">plumbline:advanced</code> or
        turns single rules on.
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link
          href="/checks"
          className="focus-ring font-medium text-ink underline underline-offset-4"
        >
          Browse the rule sets
        </Link>
        <a
          href={SCHEMA_PATH}
          className="focus-ring font-medium text-ink underline underline-offset-4"
        >
          Schema for plumbline.yaml
        </a>
      </p>
    </aside>
  );
}
