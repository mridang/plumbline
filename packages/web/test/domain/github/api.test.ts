import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import {
  GitHubApi,
  GitHubError,
  MAX_PAGES,
  TooLargeError,
} from '@/domain/github/api';

/** A fetch that answers by the start of the address and records what it saw. */
function fetchOf(
  answers: (url: string) => Response,
  seen: { url: string; headers: Record<string, string> }[] = [],
): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, headers: init?.headers as Record<string, string> });
    return answers(url);
  }) as typeof fetch;
}

describe('GitHubApi', () => {
  it('sends the token and the API version, and checks the JSON against the schema', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const api = new GitHubApi(
      'tok',
      fetchOf(() => Response.json({ a: 1 }), seen),
    );
    expect(await api.json('/x', z.object({ a: z.number() }))).toEqual({ a: 1 });
    expect(seen[0]?.url).toBe('https://api.github.com/x');
    expect(seen[0]?.headers['Authorization']).toBe('Bearer tok');
    expect(seen[0]?.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('fails with the status and path when GitHub refuses', async () => {
    const api = new GitHubApi(
      't',
      fetchOf(() => new Response('no', { status: 403 })),
    );
    await expect(api.text('/y')).rejects.toBeInstanceOf(GitHubError);
    await expect(api.text('/y')).rejects.toMatchObject({ status: 403 });
  });

  it('reads a file as text from the encoded path and branch', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const api = new GitHubApi(
      't',
      fetchOf(() => new Response('hello'), seen),
    );
    expect(await api.file('o/r', 'a b/wrangler.jsonc', 'feat/x')).toBe('hello');
    expect(seen[0]?.url).toBe(
      'https://api.github.com/repos/o/r/contents/a%20b/wrangler.jsonc?ref=feat%2Fx',
    );
    expect(seen[0]?.headers['Accept']).toBe('application/vnd.github.raw+json');
  });

  it('lists the files of a branch', async () => {
    const api = new GitHubApi(
      't',
      fetchOf(() =>
        Response.json({
          tree: [
            { path: 'a', type: 'blob' },
            { path: 'dir', type: 'tree' },
            { path: 'dir/b', type: 'blob' },
          ],
        }),
      ),
    );
    expect(await api.filePaths('o/r', 'main')).toEqual(['a', 'dir/b']);
  });

  it('reads every page of a list until a short one, and no more than the page limit', async () => {
    const full = Array.from({ length: 100 }, (_, i) => i);
    const pages: string[] = [];
    const api = new GitHubApi(
      't',
      fetchOf((url) => {
        pages.push(url);
        return Response.json({ items: pages.length === 2 ? [1] : full });
      }),
    );
    const items = await api.list(
      '/things',
      z.object({ items: z.array(z.number()) }),
      (p) => p.items,
    );
    expect(items).toHaveLength(101);
    expect(pages[1]).toContain('per_page=100&page=2');

    pages.length = 0;
    const endless = new GitHubApi(
      't',
      fetchOf(() => Response.json({ items: full })),
    );
    await endless.list(
      '/things?x=1',
      z.object({ items: z.array(z.number()) }),
      (p) => p.items,
    );
    expect(MAX_PAGES).toBeGreaterThan(1);
  });

  it('lists the repositories of an installation with their defaults', async () => {
    const api = new GitHubApi(
      't',
      fetchOf(() => Response.json({ repositories: [{ full_name: 'o/r' }] })),
    );
    expect(await api.repositories()).toEqual([
      { full_name: 'o/r', default_branch: 'main' },
    ]);
  });

  describe('writes', () => {
    /** An api whose every request is recorded, answered with `answer`. */
    const recording = (answer: () => Response) => {
      const requests: {
        method: string;
        url: string;
        body: unknown;
        type: string;
      }[] = [];
      const fetcher = (async (input: unknown, init?: RequestInit) => {
        requests.push({
          method: init?.method ?? '',
          url: String(input),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          type: String(
            (init?.headers as Record<string, string>)['Content-Type'],
          ),
        });
        return answer();
      }) as typeof fetch;
      return { api: new GitHubApi('tok', fetcher), requests };
    };

    it('reads with GET and no body', async () => {
      const requests: string[] = [];
      const api = new GitHubApi('t', (async (
        _input: unknown,
        init?: RequestInit,
      ) => {
        requests.push(`${init?.method} ${String(init?.body)}`);
        return Response.json({ a: 1 });
      }) as typeof fetch);
      await api.json('/x', z.object({ a: z.number() }));
      expect(requests).toEqual(['GET undefined']);
    });

    it('opens an issue with a JSON body and returns its number', async () => {
      const { api, requests } = recording(() =>
        Response.json({ number: 12, state: 'open' }),
      );
      const issue = await api.openIssue('acme/site', {
        title: 'T',
        body: 'B',
        labels: ['plumbline'],
      });
      expect(issue).toEqual({ number: 12, state: 'open' });
      expect(requests).toEqual([
        {
          method: 'POST',
          url: 'https://api.github.com/repos/acme/site/issues',
          body: { title: 'T', body: 'B', labels: ['plumbline'] },
          type: 'application/json',
        },
      ]);
    });

    it('edits an issue by number', async () => {
      const { api, requests } = recording(() =>
        Response.json({ number: 12, state: 'closed' }),
      );
      await api.editIssue('acme/site', 12, {
        state: 'closed',
        state_reason: 'completed',
      });
      expect(requests[0]).toMatchObject({
        method: 'PATCH',
        url: 'https://api.github.com/repos/acme/site/issues/12',
        body: { state: 'closed', state_reason: 'completed' },
      });
    });

    it('creates a finished check run on a commit', async () => {
      const { api, requests } = recording(() => Response.json({ id: 3 }));
      await api.createCheckRun('acme/site', {
        name: 'Plumbline',
        head_sha: 'abc',
        conclusion: 'failure',
        output: { title: 't', summary: 's' },
      });
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: 'https://api.github.com/repos/acme/site/check-runs',
        body: {
          name: 'Plumbline',
          head_sha: 'abc',
          status: 'completed',
          conclusion: 'failure',
        },
      });
    });

    it('fails with the status when GitHub refuses a write', async () => {
      const { api } = recording(() => new Response('no', { status: 403 }));
      await expect(
        api.openIssue('acme/site', { title: 'T', body: 'B' }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('reading a file with a size limit', () => {
    const api = (body: string) =>
      new GitHubApi('t', (async () => new Response(body)) as typeof fetch);

    it('returns a file that fits, as it would without the limit', async () => {
      expect(await api('abc').text('/x', 10)).toBe('abc');
      expect(await api('abc').file('acme/site', 'a.txt', 'main', 3)).toBe(
        'abc',
      );
    });

    it('refuses a file that is longer than the limit', async () => {
      await expect(api('abcdef').text('/x', 5)).rejects.toBeInstanceOf(
        TooLargeError,
      );
      await expect(
        api('abcdef').file('acme/site', 'a.txt', 'main', 5),
      ).rejects.toMatchObject({
        name: 'TooLargeError',
      });
    });

    it('reads a file in full when no limit is given', async () => {
      expect(await api('x'.repeat(100_000)).text('/x')).toHaveLength(100_000);
    });
  });
});
