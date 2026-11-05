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

/** The line as an object, or a thrown error when it is not JSON or has no type. */
function parseLine(text: string): ScanLine | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProblemError('The scan sent something unreadable.');
  }
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    throw new ProblemError('The scan sent something unreadable.');
  }
  const { type } = value as { type: unknown };
  // A line of a kind this page does not know is skipped, so the scanner can
  // grow new lines without breaking pages that are already open.
  return type === 'ready' ||
    type === 'done' ||
    type === 'unreachable' ||
    type === 'end'
    ? (value as ScanLine)
    : undefined;
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
  let pending = '';
  let ended = false;
  const handle = (text: string): void => {
    if (text.trim() === '') {
      return;
    }
    const line = parseLine(text);
    if (line) {
      ended ||= line.type === 'end';
      onLine(line);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      lines.forEach(handle);
    }
    pending += decoder.decode();
    handle(pending);
  } catch (error) {
    // Stop reading: cancelling the body tells the Worker, and through it the
    // scanner, to stop the scan.
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (!ended) {
    throw new ProblemError('The scan stopped before it finished.');
  }
}
