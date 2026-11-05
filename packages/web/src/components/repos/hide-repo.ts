import { ensureOk } from '@/components/api/problem-message';

/**
 * Hide a repository from the dashboard (`PUT`), or show it again (`DELETE`),
 * at `/api/users/self/repositories/hidden/{owner}/{repo}`. Rejects with the
 * problem the server gave when it refuses.
 */
export async function setRepoHidden(
  repo: string,
  hidden: boolean,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  const path = repo
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  await ensureOk(
    await transport(`/api/users/self/repositories/hidden/${path}`, {
      method: hidden ? 'PUT' : 'DELETE',
    }),
  );
}
