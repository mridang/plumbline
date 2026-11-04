import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { GitHubApi, GitHubError, MAX_PAGES } from '@/domain/github/api';

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
});
