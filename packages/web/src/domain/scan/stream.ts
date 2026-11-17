/**
 * @packageDocumentation
 *
 * Reading a scan as the scanner sends it: newline-delimited JSON, one object
 * per line, in the order the checks finish.
 *
 *   {"type":"ready","finalUrl":…,"status":…,"hints":[…]}   the page was fetched
 *   {"type":"done","outcome":{…}}                           one check finished
 *   {"type":"unreachable","detail":"…"}                     the page did not answer
 *   {"type":"end"}                                          nothing more follows
 */

import { ProblemError } from '@/components/api/problem-message';

import type { HintInfo, HintOutcome } from './outcome';

/** One line of the stream. */
export type ScanLine =
  | {
      readonly type: 'ready';
      readonly finalUrl: string;
      readonly status: number;
      readonly hints: readonly HintInfo[];
    }
  | { readonly type: 'done'; readonly outcome: HintOutcome }
  | { readonly type: 'unreachable'; readonly detail: string }
  | { readonly type: 'end' };

/** Whether a parsed line is of a kind this page knows. */
function isScanLine(value: unknown): value is ScanLine {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  return (
    typeof value.type === 'string' &&
    ['ready', 'done', 'unreachable', 'end'].includes(value.type)
  );
}

/** The line as an object, or a thrown error when it is not JSON or has no type. */
function parseLine(text: string): ScanLine | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || !('type' in value)) {
      throw new ProblemError('The scan sent something unreadable.');
    }
    // A line of a kind this page does not know is skipped, so the scanner can
    // grow new lines without breaking pages that are already open.
    return isScanLine(value) ? value : undefined;
  } catch {
    throw new ProblemError('The scan sent something unreadable.');
  }
}

/**
 * Read `body` to its end (or until `onLine` throws, which cancels it) and call `onLine` with each line as soon as it has
 * arrived, however the bytes were split. Throws a {@link ProblemError} for a
 * line that is not JSON, and when the stream stops without an `end` line (the
 * scanner went away part-way).
 */
export async function readScan(
  body: ReadableStream<Uint8Array>,
  onLine: (line: ScanLine) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  /** Reads one line; whether it was the `end` line. */
  const handle = (text: string): boolean => {
    if (text.trim() === '') {
      return false;
    }
    const line = parseLine(text);
    if (line) {
      onLine(line);
    }
    return line?.type === 'end';
  };
  /** Reads the rest of the body, one chunk after the other; whether an `end` line came. */
  const readFrom = async (
    pending: string,
    ended: boolean,
  ): Promise<boolean> => {
    const { done, value } = await reader.read();
    if (done) {
      return handle(pending + decoder.decode()) || ended;
    }
    const lines = (pending + decoder.decode(value, { stream: true })).split(
      '\n',
    );
    return readFrom(
      lines.at(-1) ?? '',
      lines.slice(0, -1).reduce((seen, text) => handle(text) || seen, ended),
    );
  };
  const consume = async (): Promise<boolean> => {
    try {
      return await readFrom('', false);
    } catch (error) {
      // Stop reading: cancelling the body tells the Worker, and through it the
      // scanner, to stop the scan.
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  };
  const finished = await consume();
  if (!finished) {
    throw new ProblemError('The scan stopped before it finished.');
  }
}
