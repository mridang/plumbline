/**
 * @packageDocumentation
 *
 * Asking a site whether its page changed, with the validators it gave
 * (`ETag`, `Last-Modified`). A site that answers 304 has not changed, so
 * nothing is read. This is validation, not caching by time: a result is never
 * reused because a clock says it is still fresh. Reports are made when a commit
 * lands and are kept by commit, never by age.
 */

/** What identifies a version of a page. */
export interface Validators {
  readonly etag: string | null;
  readonly lastModified: string | null;
}

/** The validators of a response, or null when it has none. */
export function validatorsOf(headers: Headers): Validators | null {
  const etag = headers.get('etag');
  const lastModified = headers.get('last-modified');
  return etag || lastModified ? { etag, lastModified } : null;
}

/** The request headers that ask whether a page changed since the validators were given. */
export function conditionalHeaders(
  validators: Validators | null,
): Record<string, string> {
  return {
    ...(validators?.etag ? { 'if-none-match': validators.etag } : {}),
    ...(validators?.lastModified
      ? { 'if-modified-since': validators.lastModified }
      : {}),
  };
}
