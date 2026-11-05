import type { ReactElement } from 'react';

import { Chip } from '@/components/ui-app/chip';
import { RelativeTime } from '@/components/ui-app/relative-time';
import type { Tone } from '@/components/ui-app/tone';
import type { IssueRef } from '@/domain/db/issue-history';
import { countOf } from '@/lib/intl';
import type { Finding, FindingLink, HintOutcome } from '@/domain/scan/outcome';

import { ISSUE_STATE_LABELS, STATUS_LABELS, type Status } from './results';

/** The colour of each outcome's badge. */
const BADGE_TONE: Readonly<Record<Status, Tone>> = {
  failed: 'bad',
  warned: 'warn',
  passed: 'good',
  skipped: 'neutral',
};

const LEVEL_TONE: Readonly<Record<Finding['level'], Tone>> = {
  error: 'bad',
  warning: 'warn',
  hint: 'neutral',
  information: 'neutral',
};

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
        <Chip tone={LEVEL_TONE[finding.level]} className="mr-2 capitalize">
          {finding.level}
        </Chip>
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
                <Chip className="mr-2 font-medium">{origin.source}</Chip>
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

/** The colour of each issue state's pill. */
const ISSUE_TONE: Readonly<Record<IssueRef['state'], Tone>> = {
  open: 'bad',
  fixed: 'good',
  dismissed: 'neutral',
};

export function issueUrl(
  repository: string,
  issue: Readonly<IssueRef>,
): string {
  return `https://github.com/${repository}/issues/${issue.number}`;
}

/** The GitHub issues that report a check, each a link with its state and when it was opened. */
function IssueList({
  repository,
  issues,
  now,
}: Readonly<{
  repository: string;
  issues: readonly IssueRef[];
  now?: number | undefined;
}>): ReactElement {
  return (
    <div>
      <h4 className={LABEL}>GitHub issues</h4>
      <ul className="mt-2 space-y-1.5">
        {issues.map((issue) => (
          <li key={issue.number} className="flex flex-wrap items-center gap-2">
            <Outbound href={issueUrl(repository, issue)}>
              {`#${issue.number}`}
            </Outbound>
            <Chip tone={ISSUE_TONE[issue.state]}>
              {ISSUE_STATE_LABELS[issue.state]}
            </Chip>
            <span className="text-xs text-subtle">
              opened{' '}
              <RelativeTime
                at={issue.opened_at}
                {...(now === undefined ? {} : { now })}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One check in the results: its outcome, name and id, and on opening what it
 * looks at, what it found and how to fix it. Whether it is open is the
 * caller's to say (a failed check starts open, see `openByDefault`), and the
 * caller hears when a person opens or closes it. When GitHub issues report the
 * check they are listed in its body and counted in its summary.
 */
export function HintRow({
  hint,
  open = hint.status === 'failed',
  onToggle,
  repository,
  issues = [],
  now,
}: Readonly<{
  hint: HintOutcome;
  open?: boolean;
  /** Called with the new state when the person opens or closes the check. */
  onToggle?: (open: boolean) => void;
  /** `owner/name` of the repository the issues are in. */
  repository?: string | undefined;
  /** The issues that report this check. */
  issues?: readonly IssueRef[];
  /** The server's clock when the page was made, in milliseconds, for the times shown. */
  now?: number;
}>): ReactElement {
  const problem = hint.status === 'failed' || hint.status === 'warned';
  const listed = repository !== undefined && issues.length > 0;
  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => {
        // Opening or closing it from the code fires this too: only a change
        // the person made is news.
        const isOpen = event.currentTarget.open;
        if (isOpen !== open) {
          onToggle?.(isOpen);
        }
      }}
    >
      <summary className="focus-ring-flush flex items-start gap-3 px-4 py-3 hover:bg-ink/3">
        <Chip
          tone={BADGE_TONE[hint.status]}
          className="mt-0.5 w-20 justify-center"
        >
          {STATUS_LABELS[hint.status]}
        </Chip>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{hint.name}</span>{' '}
          <code className="font-mono text-xs break-all text-subtle">
            {hint.id}
          </code>
          {hint.findings.length > 0 ? (
            <span className="ml-2 text-sm text-subtle">
              {countOf(hint.findings.length, 'finding')}
            </span>
          ) : null}
          {listed ? (
            <Chip className="ml-2 font-medium">
              {issues.length === 1
                ? `Issue #${issues[0]?.number}`
                : countOf(issues.length, 'issue')}
            </Chip>
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
        {listed ? (
          <IssueList repository={repository} issues={issues} now={now} />
        ) : null}
        <FixPanel hint={hint} problem={problem} />
        {hint.groups.length > 0 ? (
          <ul aria-label="Groups" className="flex flex-wrap gap-1.5">
            {hint.groups.map((group) => (
              <li key={group}>
                <Chip>{group}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
