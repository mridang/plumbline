/**
 * @packageDocumentation
 *
 * Putting a run's findings on GitHub. A site that is live gets one issue for
 * each check that finds a problem on it: opened when the check first fails,
 * edited when what it finds changes, closed when the problem is gone or the
 * rules stop asking for the check, and reopened if a person closes it while the
 * problem is still there (see `issue-events.ts`). A first run on a site with
 * many problems opens only a few issues at once, so the repository is not
 * flooded; the rest follow on the next runs. A preview gets a check run on the
 * commit it was built from, which GitHub shows on the pull request.
 */

import type { Database } from '@/domain/db/client';
import {
  CLAIM_MS,
  claimNewIssue,
  forgetIssue,
  issuesOfHost,
  legacyIssueOf,
  legacyIssuesOf,
  openIssuesOf,
  releaseIssueClaim,
  retireLegacyIssue,
  saveIssue,
  type StoredIssue,
} from '@/domain/db/suite';
import { isCheckId } from '@/domain/checks/catalogue';
import { GitHubError, type GitHubApi } from '@/domain/github/api';
import type { IssueLevel } from '@/domain/suite/config';
import type { StoredFinding } from '@/domain/suite/diff';
import {
  backComment,
  changedComment,
  checkIssueText,
  checkRunOutput,
  closingComment,
  conclusionOfReport,
  deferredComment,
  leftClosedComment,
  reopenedComment,
  replacedComment,
  reportedFindings,
  type CloseReason,
  type RunReport,
} from '@/domain/suite/report';
import type { Level } from '@/domain/suite/rules';

/** The label put on the issues the app opens. */
export const ISSUE_LABEL = 'plumbline';

/** The name the check run is shown under. */
export const CHECK_NAME = 'Plumbline';

/** The most issues one run opens, for all of a repository's sites together. */
export const MAX_NEW_ISSUES = 20;

/** How often the app reopens an issue a person closed while the problem is there, before it leaves it closed. */
export const MAX_REOPENS = 3;

/** The pause between two writes to GitHub, in milliseconds, so a burst of issues is not taken for abuse. */
export const WRITE_PAUSE_MS = 400;

/** What was done about the issue of a check. */
export type IssueAction = 'opened' | 'updated' | 'reopened' | 'closed' | 'none';

/** How many new issues a run may still open, shared by the sites of a repository. */
export interface IssueBudget {
  /** Issues that may still be opened. */
  remaining: number;
  /** The number of the issue opened last, to say on it that more will follow. */
  last: number | undefined;
  /** Problems that found no room. */
  deferred: number;
}

/** A budget of {@link MAX_NEW_ISSUES} new issues, or `max`. */
export function newBudget(max = MAX_NEW_ISSUES): IssueBudget {
  return { remaining: max, last: undefined, deferred: 0 };
}

/** Waits {@link WRITE_PAUSE_MS}. */
export function pauseBetweenWrites(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, WRITE_PAUSE_MS));
}

/** A run of a live site, with what is needed to report it. */
export interface SiteReport extends RunReport {
  readonly repo: string;
  readonly host: string;
  readonly sha: string | null;
  /** Which findings open an issue. */
  readonly level: IssueLevel;
  /** The level of each rule the run applied; a check that is not in it is off. */
  readonly levels: ReadonlyMap<string, Level>;
  /** The checks that did not run this time (timed out): their issues are left as they are. */
  readonly notRun?: readonly string[];
  /** Where the app shows the repository's results, for the link in an issue. */
  readonly pageUrl?: string;
  /** Where the change came in, for a comment; looked up when not given. */
  readonly origin?: () => Promise<string>;
  /** How many new issues the run may open; a fresh budget when not given. */
  readonly budget?: IssueBudget;
  /** Waits between two writes to GitHub; no wait when not given. */
  readonly pause?: () => Promise<void>;
}

/** Whether a failure says the issue no longer exists, so a new one has to be opened. */
function isGone(error: unknown): boolean {
  return (
    error instanceof GitHubError &&
    (error.status === 404 || error.status === 410)
  );
}

/** Whether a failure says GitHub is refusing the app for now, so more calls would only make it worse. */
function isThrottled(error: unknown): boolean {
  return (
    error instanceof GitHubError &&
    (error.status === 403 || error.status === 429)
  );
}

/**
 * A fingerprint of a set of findings: the same findings give the same text in
 * any order. Numbers in a message are left out, because a message that says
 * "took 1234 ms" is the same problem when it takes 1300.
 */
export async function signatureOf(
  findings: readonly StoredFinding[],
): Promise<string> {
  if (findings.length === 0) {
    return '';
  }
  const text = findings
    .map(
      (found) =>
        `${found.id}\n${found.message.replaceAll(/\d+(\.\d+)?/g, '#')}`,
    )
    .toSorted()
    .join('\n\n');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest).subarray(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Where a change came in, for a comment: the pull request that contains the
 * commit, when GitHub will say (it needs read access to pull requests), and
 * the commit. A failure to find the pull request just leaves it out. The
 * answer is looked up once, however many sites ask for it.
 */
export function originOf(
  api: GitHubApi,
  repo: string,
  sha: string | null,
): () => Promise<string> {
  let answer: Promise<string> | undefined;
  return () => {
    answer ??= (async () => {
      if (!sha) {
        return 'the latest deployment';
      }
      const commit = `commit \`${sha.slice(0, 7)}\``;
      try {
        const [pull] = await api.pullRequestsOf(repo, sha);
        return pull ? `#${pull.number} (${commit})` : commit;
      } catch {
        return commit;
      }
    })();
    return answer;
  };
}

/** Comments on an issue; a comment that cannot be made must not undo the change it describes. */
async function say(
  api: GitHubApi,
  repo: string,
  number: number,
  text: string,
): Promise<void> {
  try {
    await api.commentOnIssue(repo, number, text);
  } catch (error) {
    console.error('issue comment failed', repo, number, error);
  }
}

/** What a closing needs to know besides the issue. */
interface CloseContext {
  readonly api: GitHubApi;
  readonly db: Database;
  readonly repo: string;
  readonly host: string;
  readonly sha: string | null;
  readonly source: string | null;
  readonly origin: () => Promise<string>;
  readonly pause: () => Promise<void>;
}

/**
 * Closes the issue of a check, as done, and says why. An issue that is gone is
 * only forgotten here. A comment that fails does not undo the closing.
 */
async function closeIssue(
  context: Readonly<CloseContext>,
  check: string,
  stored: Readonly<StoredIssue>,
  reason: CloseReason,
): Promise<void> {
  const { api, db, repo, host } = context;
  let closed = true;
  await context.pause();
  try {
    await api.editIssue(repo, stored.number, {
      state: 'closed',
      state_reason: reason === 'fixed' ? 'completed' : 'not_planned',
    });
  } catch (error) {
    if (!isGone(error)) {
      throw error;
    }
    closed = false;
  }
  await saveIssue(db, repo, host, check, {
    number: stored.number,
    state: 'fixed',
    signature: '',
    reopens: stored.reopens,
  });
  if (closed) {
    await context.pause();
    await say(
      api,
      repo,
      stored.number,
      closingComment(reason, {
        repo,
        host,
        source: context.source,
        sha: context.sha,
        where: reason === 'fixed' ? await context.origin() : '',
      }),
    );
  }
}

/**
 * Closes the one issue a host had before issues were kept for each check, once.
 * The issue is closed with a comment unless a person already closed it, and the
 * old record is forgotten, so the checks that still fail get issues of their own.
 */
async function retireLegacy(
  context: Readonly<CloseContext>,
  legacy: Readonly<{ number: number; state: string }>,
): Promise<void> {
  const { api, db, repo, host } = context;
  if (legacy.state === 'open') {
    await context.pause();
    try {
      await api.editIssue(repo, legacy.number, {
        state: 'closed',
        state_reason: 'not_planned',
      });
      await context.pause();
      await say(api, repo, legacy.number, replacedComment());
    } catch (error) {
      if (!isGone(error)) {
        throw error;
      }
    }
  }
  await retireLegacyIssue(db, repo, host, legacy.number);
}

/** Why an open issue of a check that reports nothing now is closed, from the rules of the run. */
function reasonToClose(
  check: string,
  report: Readonly<SiteReport>,
  anyFinding: boolean,
): CloseReason {
  if (!isCheckId(check)) {
    return 'removed';
  }
  const level = report.levels.get(check) ?? 'off';
  if (level === 'off') {
    return 'off';
  }
  // The rule runs, but what it finds is below what opens an issue (or issues are off).
  return anyFinding || report.level === 'off' ? 'level' : 'fixed';
}

/** The findings of a run by check, in the order the checks first appear. */
function byCheck(
  findings: readonly StoredFinding[],
): Map<string, StoredFinding[]> {
  const groups = new Map<string, StoredFinding[]>();
  for (const found of findings) {
    groups.set(found.id, [...(groups.get(found.id) ?? []), found]);
  }
  return groups;
}

/**
 * Brings the issues of a site in line with the run, one issue for each check.
 * A check that finds a problem and has no issue opens one (while the run's
 * budget lasts); one that has an issue edits it when what it finds changed. A
 * check that finds nothing closes its issue, saying whether the problem was
 * fixed or the rules stopped asking for it. An issue a person closed while the
 * problem was there is left closed once the app has reopened it
 * {@link MAX_REOPENS} times, and until the problem changes before that. Two
 * deliveries for one check cannot open two issues: one claims the right first.
 * A failure for one check does not stop the others, except GitHub refusing the
 * app, which stops the run so it does not make things worse.
 */
export async function syncIssues(
  api: GitHubApi,
  db: Database,
  report: Readonly<SiteReport>,
  now = new Date(),
): Promise<Map<string, IssueAction>> {
  const { repo, host } = report;
  const pause = report.pause ?? (() => Promise.resolve());
  const origin = report.origin ?? originOf(api, repo, report.sha);
  const budget = report.budget ?? newBudget();
  const context: CloseContext = {
    api,
    db,
    repo,
    host,
    sha: report.sha,
    source: report.source,
    origin,
    pause,
  };
  const actions = new Map<string, IssueAction>();

  const legacy = await legacyIssueOf(db, repo, host);
  if (legacy) {
    await retireLegacy(context, legacy);
  }

  const reported = byCheck(reportedFindings(report.findings, report.level));
  const all = byCheck(report.findings);
  const stored = await issuesOfHost(db, repo, host);
  const notRun = new Set(report.notRun);

  for (const [check, found] of reported) {
    try {
      actions.set(
        check,
        await syncCheck(
          context,
          report,
          budget,
          check,
          found,
          stored.get(check),
          now,
        ),
      );
    } catch (error) {
      if (isThrottled(error)) {
        throw error;
      }
      console.error('issue sync failed', repo, host, check, error);
    }
  }

  for (const [check, issue] of stored) {
    if (issue.state !== 'open' || reported.has(check) || notRun.has(check)) {
      continue;
    }
    try {
      await closeIssue(
        context,
        check,
        issue,
        reasonToClose(check, report, all.has(check)),
      );
      actions.set(check, 'closed');
    } catch (error) {
      if (isThrottled(error)) {
        throw error;
      }
      console.error('issue close failed', repo, host, check, error);
    }
  }
  return actions;
}

/** Brings the issue of one check in line with what it found; `stored` is what the app knows of it. */
async function syncCheck(
  context: Readonly<CloseContext>,
  report: Readonly<SiteReport>,
  budget: IssueBudget,
  check: string,
  found: readonly StoredFinding[],
  stored: Readonly<StoredIssue> | undefined,
  now: Date,
): Promise<IssueAction> {
  const { api, db, repo, host } = context;
  const signature = await signatureOf(found);
  const text = checkIssueText({
    repo,
    host,
    url: report.url,
    sha: report.sha,
    check,
    findings: found,
    source: report.source,
    problems: report.problems,
    ...(report.pageUrl ? { pageUrl: report.pageUrl } : {}),
  });
  let current = stored;
  if (current?.state === 'opening') {
    if (now.getTime() - Date.parse(current.signature) < CLAIM_MS) {
      return 'none';
    }
    current = undefined;
  }

  if (current) {
    const left = current.state === 'dismissed';
    // A person closed it and the app has given up reopening it: it stays closed.
    if (left && current.reopens >= MAX_REOPENS) {
      return 'none';
    }
    if (left && current.signature === signature) {
      return 'none';
    }
    if (current.state === 'open' && current.signature === signature) {
      return 'none';
    }
    const reopening = current.state !== 'open';
    try {
      const where = reopening ? await context.origin() : '';
      await context.pause();
      await api.editIssue(repo, current.number, {
        ...text,
        ...(reopening ? { state: 'open', state_reason: 'reopened' } : {}),
      });
      await saveIssue(db, repo, host, check, {
        number: current.number,
        state: 'open',
        signature,
        reopens: current.reopens,
      });
      if (reopening) {
        await context.pause();
        await say(
          api,
          repo,
          current.number,
          left ? changedComment(where) : backComment(where),
        );
      }
      return reopening ? 'reopened' : 'updated';
    } catch (error) {
      // Someone deleted the issue; forget it and open a new one.
      if (!isGone(error)) {
        throw error;
      }
      await forgetIssue(db, repo, current.number);
    }
  }

  if (budget.remaining <= 0) {
    budget.deferred += 1;
    return 'none';
  }
  if (!(await claimNewIssue(db, repo, host, check, now))) {
    return 'none';
  }
  try {
    await context.pause();
    const created = await api.openIssue(repo, {
      ...text,
      labels: [ISSUE_LABEL],
    });
    await saveIssue(db, repo, host, check, {
      number: created.number,
      state: 'open',
      signature,
      reopens: 0,
    });
    budget.remaining -= 1;
    budget.last = created.number;
  } catch (error) {
    await releaseIssueClaim(db, repo, host, check);
    throw error;
  }
  return 'opened';
}

/**
 * Says on the issue opened last that more problems were found than the run may
 * open issues for, so the missing ones are not a surprise. Nothing is said when
 * everything found room.
 */
export async function noteDeferred(
  api: GitHubApi,
  repo: string,
  budget: Readonly<IssueBudget>,
): Promise<void> {
  if (budget.deferred > 0 && budget.last !== undefined) {
    await say(api, repo, budget.last, deferredComment(budget.deferred));
  }
}

/**
 * Closes what the repository no longer deploys: the open issues of hosts that
 * are not among `hosts`, and the issues of the old kind of such hosts. With
 * `reason` `disabled` or `config` (and no hosts) it closes them all, because
 * checks for the repository were turned off, by the switch or by its file.
 */
export async function closeUndeployed(
  api: GitHubApi,
  db: Database,
  input: Readonly<{
    repo: string;
    hosts: ReadonlySet<string>;
    sha: string | null;
    source: string | null;
    pause?: () => Promise<void>;
    reason?: 'undeployed' | 'disabled' | 'config';
  }>,
): Promise<void> {
  const { repo } = input;
  const reason = input.reason ?? 'undeployed';
  const pause = input.pause ?? (() => Promise.resolve());
  const origin = originOf(api, repo, input.sha);
  for (const issue of await openIssuesOf(db, repo)) {
    if (input.hosts.has(issue.host)) {
      continue;
    }
    try {
      await closeIssue(
        {
          api,
          db,
          repo,
          host: issue.host,
          sha: input.sha,
          source: input.source,
          origin,
          pause,
        },
        issue.check,
        issue,
        reason,
      );
    } catch (error) {
      if (isThrottled(error)) {
        throw error;
      }
      console.error('issue close failed', repo, issue.host, issue.check, error);
    }
  }
  for (const legacy of await legacyIssuesOf(db, repo)) {
    if (!input.hosts.has(legacy.host)) {
      try {
        await retireLegacy(
          {
            api,
            db,
            repo,
            host: legacy.host,
            sha: input.sha,
            source: input.source,
            origin,
            pause,
          },
          legacy,
        );
      } catch (error) {
        if (isThrottled(error)) {
          throw error;
        }
        console.error('issue retire failed', repo, legacy.host, error);
      }
    }
  }
}

/** Reopens, with a comment, the issue a person closed while its problem is still there; false when the limit is reached. */
export async function reopenIssue(
  api: GitHubApi,
  db: Database,
  input: Readonly<{
    repo: string;
    host: string;
    check: string;
    issue: Readonly<StoredIssue>;
  }>,
): Promise<boolean> {
  const { repo, host, check, issue } = input;
  if (issue.reopens >= MAX_REOPENS) {
    await saveIssue(db, repo, host, check, { ...issue, state: 'dismissed' });
    await say(api, repo, issue.number, leftClosedComment(check));
    return false;
  }
  await api.editIssue(repo, issue.number, {
    state: 'open',
    state_reason: 'reopened',
  });
  await saveIssue(db, repo, host, check, {
    ...issue,
    state: 'open',
    reopens: issue.reopens + 1,
  });
  await say(api, repo, issue.number, reopenedComment(check, host));
  return true;
}

/** A run of a preview, with what is needed to report it. */
export interface PreviewReport extends RunReport {
  readonly repo: string;
  readonly sha: string;
  /** The id of the stored report; the check's own id for it. */
  readonly reportId?: string;
}

/** Reports a run of a preview as a finished check on the commit it was built from. */
export async function publishCheckRun(
  api: GitHubApi,
  report: Readonly<PreviewReport>,
): Promise<void> {
  await api.createCheckRun(report.repo, {
    name: CHECK_NAME,
    head_sha: report.sha,
    conclusion: conclusionOfReport(report),
    // "Details" opens the report, which needs no sign-in; the preview itself
    // is linked in the report.
    details_url: report.reportUrl ?? report.url,
    ...(report.reportId ? { external_id: report.reportId } : {}),
    output: checkRunOutput(report),
  });
}

/** Reports that a preview could not be reached, so the missing check is explained. */
export async function publishUnreachable(
  api: GitHubApi,
  repo: string,
  sha: string,
  url: string,
): Promise<void> {
  await api.createCheckRun(repo, {
    name: CHECK_NAME,
    head_sha: sha,
    conclusion: 'neutral',
    details_url: url,
    output: {
      title: 'The preview could not be reached',
      summary: `Plumbline could not fetch ${url}, so nothing was checked. A preview that is protected by a login cannot be checked.`,
    },
  });
}
