/**
 * @packageDocumentation
 *
 * A scan run on the server: the Worker hands the address of a scan it started
 * to the scanner container (`lib/cloudflare/scanner-container.ts`), which runs
 * every check in Node and streams one line of JSON for each (see `stream.ts`
 * for the lines). The Worker passes the stream on as it is.
 */

/**
 * Scans started from the page are spread over this many scanner objects (a
 * container each), so a busy minute is not one container's queue. They take
 * their share of the containers `max_instances` allows (see `wrangler.jsonc`).
 */
export const INTERACTIVE_SHARDS = 2;

/** The name of the scanner object for the next page scan. */
export function interactiveName(random: () => number = Math.random): string {
  return `interactive-${Math.floor(random() * INTERACTIVE_SHARDS)}`;
}

/** The part of the container's Durable Object namespace the Worker uses. */
export interface ScannerNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** The scanner could not be reached or refused the scan. */
export class ScannerError extends Error {
  public constructor(detail: string) {
    super(detail);
    this.name = 'ScannerError';
  }
}

/** The media type of the stream the scanner answers with. */
export const NDJSON = 'application/x-ndjson';

/**
 * Start the scan of `url` in the scanner and return its stream. Throws
 * {@link ScannerError} when there is no container or it did not start or
 * answer. `signal` stops the scan when the caller goes away.
 */
export async function runOnServer(
  namespace: ScannerNamespace | undefined,
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (!namespace) {
    throw new ScannerError('Scans are not available.');
  }
  const stub = namespace.get(namespace.idFromName(interactiveName()));
  const answer = await stub.fetch(
    new Request('https://scanner.internal/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      ...(signal ? { signal } : {}),
    }),
  );
  if (!answer.ok || !answer.body) {
    throw new ScannerError('The scanner did not answer.');
  }
  return new Response(answer.body, {
    status: 200,
    headers: { 'content-type': NDJSON, 'cache-control': 'no-store' },
  });
}
