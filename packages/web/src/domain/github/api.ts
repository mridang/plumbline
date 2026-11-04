/**
 * @packageDocumentation
 *
 * A small client for GitHub's REST API: authenticated requests that read JSON
 * or raw file text, and the endpoints this app uses. It takes a `fetch`, so a
 * test hands it a fake.
 */

import { z } from 'zod';

import { readTextCapped } from '@/domain/suite/capped-text';

/** The page size GitHub allows at most. */
const PER_PAGE = 100;

/** The most pages read of a list, so a huge account cannot run a request out of time. */
export const MAX_PAGES = 5;

/** A repository an installation can reach. */
export const RepoSchema = z.object({
  full_name: z.string(),
  default_branch: z.string().default('main'),
  homepage: z.string().nullish(),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
});

/** One repository of an installation. */
export type Repo = z.infer<typeof RepoSchema>;

const IssueSchema = z.object({ number: z.number(), state: z.string() });

const PullSchema = z.object({
  number: z.number(),
  merged_at: z.string().nullish(),
});

/** A pull request that contains a commit. */
export type PullRef = z.infer<typeof PullSchema>;

/** An issue as GitHub reports it back. */
export type IssueRef = z.infer<typeof IssueSchema>;

const TreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

/** Why a request to GitHub failed. */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** A file is longer than the most the caller would read. */
export class TooLargeError extends Error {
  constructor(readonly path: string) {
    super(`${path} is longer than the limit`);
    this.name = 'TooLargeError';
  }
}

/** Talks to the GitHub API with one bearer token. */
export class GitHubApi {
  readonly #fetch: typeof fetch;

  /**
   * @param token The installation or user access token.
   * @param fetcher The `fetch` to use; wrapped because Workers reject the global one called as a method.
   */
  constructor(
    private readonly token: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.#fetch = (input, init) => fetcher(input, init);
  }

  async #send(
    path: string,
    accept: string,
    write?: { method: 'POST' | 'PATCH'; body: unknown },
  ): Promise<Response> {
    const response = await this.#fetch(`https://api.github.com${path}`, {
      method: write?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plumbline',
        ...(write ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(write ? { body: JSON.stringify(write.body) } : {}),
    });
    if (!response.ok) {
      throw new GitHubError(
        `GitHub answered ${response.status} for ${path}`,
        response.status,
      );
    }
    return response;
  }

  /** A JSON document, checked against `schema`. */
  async json<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await this.#send(path, 'application/vnd.github+json');
    return schema.parse(await response.json());
  }

  /** What GitHub answers to a POST or PATCH of `body`, checked against `schema`. */
  async write<T>(
    method: 'POST' | 'PATCH',
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await this.#send(path, 'application/vnd.github+json', {
      method,
      body,
    });
    return schema.parse(await response.json());
  }

  /** A file's text; a file longer than `maxBytes` (when given) is refused with a {@link TooLargeError}. */
  async text(path: string, maxBytes?: number): Promise<string> {
    const response = await this.#send(path, 'application/vnd.github.raw+json');
    if (maxBytes === undefined) {
      return response.text();
    }
    const { text, truncated } = await readTextCapped(response, maxBytes);
    if (truncated) {
      throw new TooLargeError(path);
    }
    return text;
  }

  /**
   * Every item of a paged list, up to {@link MAX_PAGES} pages. `pick` takes
   * the items out of a page (GitHub wraps some lists in an object).
   */
  async list<P, I>(
    path: string,
    schema: z.ZodType<P>,
    pick: (page: P) => readonly I[],
  ): Promise<I[]> {
    const items: I[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const joiner = path.includes('?') ? '&' : '?';
      const got = pick(
        await this.json(
          `${path}${joiner}per_page=${PER_PAGE}&page=${page}`,
          schema,
        ),
      );
      items.push(...got);
      if (got.length < PER_PAGE) {
        break;
      }
    }
    return items;
  }

  /** The repositories an installation token can reach. */
  repositories(): Promise<Repo[]> {
    return this.list(
      '/installation/repositories',
      z.object({ repositories: z.array(RepoSchema) }),
      (page) => page.repositories,
    );
  }

  /** The paths of every file of a repository's branch. */
  async filePaths(fullName: string, branch: string): Promise<string[]> {
    const tree = await this.json(
      `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      TreeSchema,
    );
    return tree.tree.filter((e) => e.type === 'blob').map((e) => e.path);
  }

  /** Opens an issue. */
  openIssue(
    fullName: string,
    issue: Readonly<{ title: string; body: string; labels?: string[] }>,
  ): Promise<IssueRef> {
    return this.write('POST', `/repos/${fullName}/issues`, issue, IssueSchema);
  }

  /** Changes an issue: its text, or whether it is open. */
  editIssue(
    fullName: string,
    number: number,
    change: Readonly<{
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      state_reason?: 'completed' | 'reopened';
    }>,
  ): Promise<IssueRef> {
    return this.write(
      'PATCH',
      `/repos/${fullName}/issues/${number}`,
      change,
      IssueSchema,
    );
  }

  /** Adds a comment to an issue. */
  async commentOnIssue(
    fullName: string,
    number: number,
    body: string,
  ): Promise<void> {
    await this.write(
      'POST',
      `/repos/${fullName}/issues/${number}/comments`,
      { body },
      z.object({ id: z.number() }),
    );
  }

  /** The pull requests that contain a commit, the merged ones first. */
  async pullRequestsOf(fullName: string, sha: string): Promise<PullRef[]> {
    const pulls = await this.json(
      `/repos/${fullName}/commits/${encodeURIComponent(sha)}/pulls`,
      z.array(PullSchema),
    );
    return pulls.toSorted(
      (a, b) => Number(Boolean(b.merged_at)) - Number(Boolean(a.merged_at)),
    );
  }

  /** Reports a finished check on a commit, which shows on the pull requests that contain it. */
  async createCheckRun(
    fullName: string,
    run: Readonly<{
      name: string;
      head_sha: string;
      conclusion: 'success' | 'failure' | 'neutral';
      details_url?: string;
      /** Our own id for the run (the report's), so it can be found from the check. */
      external_id?: string;
      output: { title: string; summary: string; text?: string };
    }>,
  ): Promise<void> {
    await this.write(
      'POST',
      `/repos/${fullName}/check-runs`,
      { ...run, status: 'completed' },
      z.object({ id: z.number() }),
    );
  }

  /**
   * Sends a `repository_dispatch` event, which starts the repository's
   * workflows that listen for `eventType`. GitHub answers 204 with no body.
   * It needs the app's Contents permission to be read and write.
   */
  async dispatchEvent(
    fullName: string,
    eventType: string,
    clientPayload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.#send(
      `/repos/${fullName}/dispatches`,
      'application/vnd.github+json',
      {
        method: 'POST',
        body: { event_type: eventType, client_payload: clientPayload },
      },
    );
  }

  /** One file of a repository, as text, at most `maxBytes` long when that is given. */
  file(
    fullName: string,
    path: string,
    branch: string,
    maxBytes?: number,
  ): Promise<string> {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return this.text(
      `/repos/${fullName}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
      maxBytes,
    );
  }
}
