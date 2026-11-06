import { describe, expect, it } from '@jest/globals';

import { setRepoChecks } from '@/components/repos/repo-checks';

/** A transport that records what it was asked and answers with `status`. */
function transport(status = 204) {
  const calls: Array<[string, string | undefined]> = [];
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    calls.push([String(url), init?.method]);
    return status === 204
      ? new Response(null, { status })
      : Response.json({ title: 'Not found', status }, { status });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe('setRepoChecks', () => {
  it('turns checks off with PUT at the repository', async () => {
    const { fetcher, calls } = transport();
    await setRepoChecks('acme/site', false, fetcher);
    expect(calls).toEqual([
      ['/api/users/self/repositories/disabled/acme/site', 'PUT'],
    ]);
  });

  it('turns checks on with DELETE, encoding each part of the name', async () => {
    const { fetcher, calls } = transport();
    await setRepoChecks('acme/site name', true, fetcher);
    expect(calls).toEqual([
      ['/api/users/self/repositories/disabled/acme/site%20name', 'DELETE'],
    ]);
  });

  it('rejects when the server refuses', async () => {
    const { fetcher } = transport(404);
    await expect(setRepoChecks('acme/site', false, fetcher)).rejects.toThrow();
  });
});
