/**
 * The address of a repository's page, `/repos/{owner}/{name}`, for a repository
 * named `owner/name`.
 */
export function repoPath(repo: string): string {
  return `/repos/${repo
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}
