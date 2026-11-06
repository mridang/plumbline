import { ensureOk } from '@/components/api/problem-message';

/**
 * Turn the checks of a repository off (`PUT`) or on again (`DELETE`), at
 * `/api/users/self/repositories/disabled/{owner}/{repo}`. Rejects with the
 * problem the server gave when it refuses.
 */
export async function setRepoChecks(
  repo: string,
  on: boolean,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  const path = repo
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  await ensureOk(
    await transport(`/api/users/self/repositories/disabled/${path}`, {
      method: on ? 'DELETE' : 'PUT',
    }),
  );
}
