/**
 * What may be scanned, as rules that need nothing from Node: http(s) only, the
 * default port or one of 80, 443, 8080 and 8443, and no user name or password in
 * the address. Whether the address is on the public internet is the business of
 * whoever opens the connection (the guard in Node, the probe in a Worker).
 */

/** The ports a scan may be pointed at, besides the default of the scheme. */
export const ALLOWED_PORTS: ReadonlySet<number> = new Set([
  80, 443, 8080, 8443,
]);

/** An address a scan refuses, with the reason in words for the person who asked. */
export class ScanRefusedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ScanRefusedError';
  }
}

/** Throws a {@link ScanRefusedError} unless the scheme, port and credentials of `url` may be scanned. */
export function assertScannable(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScanRefusedError(
      `Only http and https can be fetched, not ${url.protocol}`,
    );
  }
  if (url.port !== '' && !ALLOWED_PORTS.has(Number(url.port))) {
    throw new ScanRefusedError(`Port ${url.port} cannot be fetched`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new ScanRefusedError(
      'An address with a user name or password cannot be fetched',
    );
  }
}
