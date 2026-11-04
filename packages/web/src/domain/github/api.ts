/**
 * @packageDocumentation
 *
 * A small client for GitHub's REST API: authenticated requests that read JSON
 * or raw file text, and the endpoints this app uses. It takes a `fetch`, so a
 * test hands it a fake.
 */

import { z } from 'zod';

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

  async #send(path: string, accept: string): Promise<Response> {
    const response = await this.#fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plumbline',
      },
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

  /** A file's text. */
  async text(path: string): Promise<string> {
    const response = await this.#send(path, 'application/vnd.github.raw+json');
    return response.text();
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

  /** One file of a repository, as text. */
  file(fullName: string, path: string, branch: string): Promise<string> {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return this.text(
      `/repos/${fullName}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
    );
  }
}
