/**
 * @packageDocumentation
 *
 * Putting a run's findings on GitHub. A site that is live gets one issue that
 * tracks its problems: opened when the first problem is found, edited when the
 * problems change, reopened if it was closed and the problems are back, and
 * closed when they are gone. A preview gets a check run on the commit it was
 * built from, which GitHub shows on the pull request.
 */

import type { Database } from '@/domain/db/client';
import {
  CLAIM_MS,
  claimNewIssue,
  forgetIssue,
  issueOf,
  releaseIssueClaim,
  saveIssue,
} from '@/domain/db/suite';
import { GitHubError, type GitHubApi } from '@/domain/github/api';
import type { IssueLevel } from '@/domain/suite/config';
import type { StoredFinding } from '@/domain/suite/diff';
import {
  checkRunOutput,
  conclusionOf,
  issueText,
  reportedFindings,
  type RunReport,
} from '@/domain/suite/report';

/** The label put on the issues the app opens. */
export const ISSUE_LABEL = 'plumbline';

/** The name the check run is shown under. */
export const CHECK_NAME = 'Plumbline';

/** What was done about a site's issue. */
export type IssueAction = 'opened' | 'updated' | 'reopened' | 'closed' | 'none';

/** A run of a live site, with what is needed to report it. */
export interface SiteReport extends RunReport {
  readonly repo: string;
  readonly host: string;
  readonly sha: string | null;
  /** Which findings open an issue. */
  readonly level: IssueLevel;
  /** True when the page and the rules are the same as at the previous run. */
  readonly unchanged?: boolean;
  /** Where the change came in, for a comment; looked up when not given. */
  readonly origin?: () => Promise<string>;
}

/** Whether a failure says the issue no longer exists, so a new one has to be opened. */
function isGone(error: unknown): boolean {
  return (
    error instanceof GitHubError &&
    (error.status === 404 || error.status === 410)
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
      (found) => `${found.id}\n${found.message.replace(/\d+(\.\d+)?/g, '#')}`,
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

/**
 * Brings the site's issue in line with the run. The first problem opens an
 * issue, and a later run edits it. When the problems are gone the app closes
 * the issue and comments with the pull request that fixed them, and reopens
 * it, saying so, if they come back. An issue a person closed while the
 * problems were still there is left closed until the problems change. Two
 * deliveries for one site cannot open two issues: one claims the right first.
 */
export async function syncIssue(
  api: GitHubApi,
  db: Database,
  report: Readonly<SiteReport>,
  now = new Date(),
): Promise<IssueAction> {
  const { repo, host } = report;
  if (report.level === 'off') {
    return 'none';
  }
  const origin = report.origin ?? originOf(api, repo, report.sha);
  let stored = await issueOf(db, repo, host);
  const reported = reportedFindings(report.findings, report.level);
  const signature = await signatureOf(reported);

  if (stored?.state === 'opening') {
    if (now.getTime() - Date.parse(stored.signature) < CLAIM_MS) {
      return 'none';
    }
    stored = undefined;
  }

  if (reported.length === 0) {
    if (stored?.state === 'dismissed') {
      // Nothing is wrong now; if it comes back it is a new problem.
      await saveIssue(db, repo, host, { ...stored, state: 'fixed', signature });
      return 'none';
    }
    if (stored?.state !== 'open') {
      return 'none';
    }
    const where = await origin();
    let closed = true;
    try {
      await api.editIssue(repo, stored.number, {
        state: 'closed',
        state_reason: 'completed',
      });
    } catch (error) {
      if (!isGone(error)) {
        throw error;
      }
      closed = false;
    }
    await saveIssue(db, repo, host, {
      number: stored.number,
      state: 'fixed',
      signature,
    });
    if (closed) {
      await say(
        api,
        repo,
        stored.number,
        `Plumbline no longer finds these problems as of ${where}, so this issue is closed. It opens again if they come back.`,
      );
    }
    return 'closed';
  }

  if (stored?.state === 'dismissed' && stored.signature === signature) {
    return 'none';
  }
  if (
    report.unchanged &&
    stored?.state === 'open' &&
    stored.signature === signature
  ) {
    return 'none';
  }
  const text = issueText(report);
  if (stored) {
    const reopening = stored.state !== 'open';
    try {
      const where = reopening ? await origin() : '';
      await api.editIssue(repo, stored.number, {
        ...text,
        ...(reopening ? { state: 'open', state_reason: 'reopened' } : {}),
      });
      await saveIssue(db, repo, host, {
        number: stored.number,
        state: 'open',
        signature,
      });
      if (reopening) {
        await say(
          api,
          repo,
          stored.number,
          stored.state === 'dismissed'
            ? `Plumbline found other problems as of ${where}, so this issue is open again.`
            : `These problems are back as of ${where}, so this issue is open again.`,
        );
      }
      return reopening ? 'reopened' : 'updated';
    } catch (error) {
      // Someone deleted the issue; forget it and open a new one.
      if (!isGone(error)) {
        throw error;
      }
      await forgetIssue(db, repo, stored.number);
    }
  }
  if (!(await claimNewIssue(db, repo, host, now))) {
    return 'none';
  }
  try {
    const created = await api.openIssue(repo, {
      ...text,
      labels: [ISSUE_LABEL],
    });
    await saveIssue(db, repo, host, {
      number: created.number,
      state: 'open',
      signature,
    });
  } catch (error) {
    await releaseIssueClaim(db, repo, host);
    throw error;
  }
  return 'opened';
}

/** A run of a preview, with what is needed to report it. */
export interface PreviewReport extends RunReport {
  readonly repo: string;
  readonly sha: string;
}

/** Reports a run of a preview as a finished check on the commit it was built from. */
export async function publishCheckRun(
  api: GitHubApi,
  report: Readonly<PreviewReport>,
): Promise<void> {
  await api.createCheckRun(report.repo, {
    name: CHECK_NAME,
    head_sha: report.sha,
    conclusion: conclusionOf(report.findings),
    details_url: report.url,
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
