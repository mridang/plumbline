import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import type { Finding, FindingLink, HintOutcome } from '@/domain/scan/outcome';

import { STATUS_LABELS, type Status } from './results';

/** The colour of each outcome's badge. */
const BADGE: Readonly<Record<Status, string>> = {
  failed: 'bg-failed text-white',
  warned: 'bg-warned text-white',
  passed: 'bg-passed text-white',
  skipped: 'bg-skipped/15 text-skipped',
};

/** The colour of each finding's level. */
const LEVEL: Readonly<Record<Finding['level'], string>> = {
  error: 'bg-failed/10 text-failed',
  warning: 'bg-warned/10 text-warned',
  hint: 'bg-ink/5 text-muted',
  information: 'bg-ink/5 text-muted',
};

/** A small heading inside a check. */
const LABEL = 'text-label font-semibold text-subtle uppercase';

/**
 * Whether text may be drawn as a link. Findings and origins are data from the
 * scanned site and the hints package, so only plain http(s) addresses become
 * links; anything else (`javascript:`, `data:`) is shown as text.
 */
export function isWebLink(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Where a finding is: the resource, with the line and column when known. */
export function placeOf(finding: Readonly<Finding>): string {
  if (finding.line === undefined) {
    return finding.resource;
  }
  const column = finding.column === undefined ? '' : `:${finding.column}`;
  return `${finding.resource}:${finding.line}${column}`;
}

/** The further reading of a check's findings, each address once, in the order given. */
export function furtherReading(
  findings: readonly Finding[],
): readonly FindingLink[] {
  const seen = new Map<string, FindingLink>();
  for (const link of findings.flatMap((finding) => finding.links ?? [])) {
    if (isWebLink(link.url) && !seen.has(link.url)) {
      seen.set(link.url, link);
    }
  }
  return [...seen.values()];
}

/** A link to somewhere else, or the address as text when it is not a web link. */
function Outbound({
  href,
  children,
}: Readonly<{ href: string; children: string }>): ReactElement {
  return isWebLink(href) ? (
    <a href={href} className="focus-ring break-all text-accent underline">
      {children}
    </a>
  ) : (
    <span className="break-all">{children}</span>
  );
}

/** One thing a check found: how serious, what, where, and the evidence. */
function FindingItem({
  finding,
}: Readonly<{ finding: Finding }>): ReactElement {
  return (
    <li className="rounded-control border border-line p-3">
      <p>
        <span
          className={cn(
            'mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
            LEVEL[finding.level],
          )}
        >
          {finding.level}
        </span>
        {finding.message}
      </p>
      <p className="mt-1 text-xs text-subtle">
        <Outbound href={finding.resource}>{placeOf(finding)}</Outbound>
      </p>
      {finding.snippet ? (
        <figure className="mt-2">
          <figcaption className="text-xs text-subtle">
            Evidence{finding.language ? ` (${finding.language})` : ''}
          </figcaption>
          <pre className="mt-1 overflow-x-auto rounded-control bg-ink/5 p-3 font-mono text-xs whitespace-pre-wrap">
            {finding.snippet}
          </pre>
        </figure>
      ) : null}
    </li>
  );
}

/**
 * How to put a check right, and where its rule comes from: who usually makes
 * the fix, the rule itself, any further reading the findings gave, and the
 * upstream checks it was taken from. Titled "How to fix" for a check that
 * failed or warned, and "About this rule" otherwise.
 */
function FixPanel({
  hint,
  problem,
}: Readonly<{ hint: HintOutcome; problem: boolean }>): ReactElement | null {
  const reading = furtherReading(hint.findings);
  const origins = hint.origins;
  const fixer = problem ? hint.fixer : undefined;
  if (
    !fixer &&
    !hint.reference &&
    reading.length === 0 &&
    origins.length === 0
  ) {
    return null;
  }
  return (
    <div className="space-y-2 rounded-control bg-brand/5 p-3">
      <h4 className={LABEL}>{problem ? 'How to fix' : 'About this rule'}</h4>
      {fixer ? (
        <p>
          <span className="font-semibold">Usually fixed in:</span> {fixer}.
          {hint.findings.some((finding) => finding.snippet) ? (
            <> The evidence above shows what is at fault or what to add.</>
          ) : null}
        </p>
      ) : null}
      {hint.reference ? (
        <p>
          <span className="font-semibold">The rule:</span>{' '}
          <Outbound href={hint.reference}>{hint.reference}</Outbound>
        </p>
      ) : null}
      {reading.length > 0 ? (
        <div>
          <p className="font-semibold">Further reading</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {reading.map((link) => (
              <li key={link.url}>
                <Outbound href={link.url}>{link.text}</Outbound>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {origins.length > 0 ? (
        <div>
          <p className="font-semibold">Where this check comes from</p>
          <ul className="mt-1 space-y-2">
            {origins.map((origin) => (
              <li key={`${origin.source} ${origin.url} ${origin.title}`}>
                <span className="mr-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium">
                  {origin.source}
                </span>
                <Outbound href={origin.url}>{origin.title}</Outbound>
                {origin.docsUrl && isWebLink(origin.docsUrl) ? (
                  <>
                    {' '}
                    (<Outbound href={origin.docsUrl}>docs</Outbound>)
                  </>
                ) : null}
                {origin.summary ? (
                  <p className="mt-0.5 text-muted">{origin.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One check in the results: its outcome, name and id, and on opening what it
 * looks at, what it found and how to fix it. A check that failed or warned
 * starts open, so every fix is on the page without a click.
 */
export function HintRow({
  hint,
}: Readonly<{ hint: HintOutcome }>): ReactElement {
  const problem = hint.status === 'failed' || hint.status === 'warned';
  return (
    <details className="group" open={problem}>
      <summary className="focus-ring-flush flex items-start gap-3 px-4 py-3 hover:bg-ink/3">
        <span
          className={cn(
            'mt-0.5 inline-flex w-20 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
            BADGE[hint.status],
          )}
        >
          {STATUS_LABELS[hint.status]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{hint.name}</span>{' '}
          <code className="font-mono text-xs break-all text-subtle">
            {hint.id}
          </code>
          {hint.findings.length > 0 ? (
            <span className="ml-2 text-sm text-subtle">
              {hint.findings.length}{' '}
              {hint.findings.length === 1 ? 'finding' : 'findings'}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="space-y-4 px-4 pb-5 text-sm sm:pl-27">
        <p className="text-muted">{hint.description}</p>
        {hint.reason ? <p className="text-skipped">{hint.reason}</p> : null}
        {hint.findings.length > 0 ? (
          <div>
            <h4 className={LABEL}>What was found</h4>
            <ul className="mt-2 space-y-2">
              {hint.findings.map((finding, index) => (
                <FindingItem key={index} finding={finding} />
              ))}
            </ul>
          </div>
        ) : null}
        <FixPanel hint={hint} problem={problem} />
        {hint.groups.length > 0 ? (
          <ul aria-label="Groups" className="flex flex-wrap gap-1.5">
            {hint.groups.map((group) => (
              <li
                key={group}
                className="rounded-full border border-line px-2 py-0.5 text-xs text-subtle"
              >
                {group}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
