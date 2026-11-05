/**
 * @packageDocumentation
 *
 * A scan as the page runs it: start it (`POST /api/scans`), have the server
 * run every check (`POST /api/scans/{id}/run`) and hand each result to the page
 * as it arrives. The checks themselves run in the scanner container; nothing
 * here knows how.
 */

import { ensureOk, ProblemError } from '@/components/api/problem-message';

import type { HintInfo } from './catalogue';
import type { HintOutcome } from './engine';
import { readScan } from './stream';

/** What the page is told as a scan goes on. */
export interface ScanCallbacks {
  /** The page was fetched and these are the checks that will run. */
  readonly onStart: (start: {
    readonly finalUrl: string;
    readonly status: number;
    readonly hints: readonly HintInfo[];
  }) => void;
  /** One check finished. */
  readonly onOutcome: (outcome: HintOutcome) => void;
}

/** How a scan is run besides the callbacks. */
export interface ScanOptions {
  /** The `fetch` to call the API with; the page's own by default. */
  readonly transport?: typeof fetch;
  /** Show only these checks (every check when left out). */
  readonly only?: readonly string[];
}

/** Start a scan of `input` and return its id. */
async function startScan(
  input: string,
  transport: typeof fetch,
): Promise<{ readonly id: string }> {
  const response = await transport('/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: input }),
  });
  await ensureOk(response);
  return (await response.json()) as { id: string };
}

/**
 * Scan `input`: tell `callbacks` about the checks as the server finishes
 * them, and resolve once every one has. Rejects with a {@link ProblemError}
 * (to show as it is) when the address is refused, the page does not answer or
 * the server stops.
 */
export async function runScan(
  input: string,
  callbacks: ScanCallbacks,
  { transport = (url, init) => fetch(url, init), only }: ScanOptions = {},
): Promise<void> {
  const scan = await startScan(input, transport);
  const response = await transport(
    `/api/scans/${encodeURIComponent(scan.id)}/run`,
    { method: 'POST' },
  );
  await ensureOk(response);
  if (!response.body) {
    throw new ProblemError('The scan stopped.');
  }
  const chosen = only === undefined ? undefined : new Set(only);
  let started = false;
  await readScan(response.body, (line) => {
    if (line.type === 'unreachable') {
      throw new ProblemError(line.detail);
    }
    if (line.type === 'ready') {
      started = true;
      callbacks.onStart({
        finalUrl: line.finalUrl,
        status: line.status,
        hints: chosen
          ? line.hints.filter((hint) => chosen.has(hint.id))
          : line.hints,
      });
    } else if (
      line.type === 'done' &&
      (!chosen || chosen.has(line.outcome.id))
    ) {
      callbacks.onOutcome(line.outcome);
    }
  });
  if (!started) {
    throw new ProblemError('The scan stopped.');
  }
}
