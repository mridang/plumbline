import { describe, expect, it } from '@jest/globals';

import { ProblemError } from '@/components/api/problem-message';
import { readScan, type ScanLine } from '@/domain/scan/stream';

/** A body that delivers `chunks` one by one. */
function body(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

const END = '{"type":"end"}\n';

/** Everything `readScan` reports for `chunks`. */
async function lines(...chunks: string[]): Promise<ScanLine[]> {
  const got: ScanLine[] = [];
  await readScan(body(...chunks), (line) => got.push(line));
  return got;
}

describe('readScan', () => {
  it('reports each line as an object, in order', async () => {
    expect(await lines('{"type":"unreachable","detail":"x"}\n', END)).toEqual([
      { type: 'unreachable', detail: 'x' },
      { type: 'end' },
    ]);
  });

  it('puts a line back together however the bytes were split, even inside a character', async () => {
    const whole = '{"type":"unreachable","detail":"é"}\n' + END;
    const bytes = new TextEncoder().encode(whole);
    const got: ScanLine[] = [];
    await readScan(
      new ReadableStream({
        start(controller) {
          for (const byte of bytes) {
            controller.enqueue(new Uint8Array([byte]));
          }
          controller.close();
        },
      }),
      (line) => got.push(line),
    );
    expect(got[0]).toEqual({ type: 'unreachable', detail: 'é' });
  });

  it('reads a last line that has no newline', async () => {
    expect(await lines('{"type":"end"}')).toEqual([{ type: 'end' }]);
  });

  it('skips blank lines and lines of a kind it does not know', async () => {
    expect(await lines('\n{"type":"progress"}\n\n', END)).toEqual([
      { type: 'end' },
    ]);
  });

  it('hands over each line as it arrives, before the stream is done', async () => {
    let release: () => void = () => undefined;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          new TextEncoder().encode('{"type":"unreachable","detail":"a"}\n'),
        );
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        controller.enqueue(new TextEncoder().encode(END));
        controller.close();
      },
    });
    const got: string[] = [];
    const reading = readScan(stream, (line) => got.push(line.type));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(got).toEqual(['unreachable']);
    release();
    await reading;
    expect(got).toEqual(['unreachable', 'end']);
  });

  it('rejects a line that is not JSON, and one without a type', async () => {
    await expect(lines('nope\n', END)).rejects.toBeInstanceOf(ProblemError);
    await expect(lines('{"x":1}\n', END)).rejects.toBeInstanceOf(ProblemError);
    await expect(lines('"text"\n', END)).rejects.toBeInstanceOf(ProblemError);
  });

  it('rejects when the stream stops without an end line', async () => {
    await expect(
      lines('{"type":"unreachable","detail":"a"}\n'),
    ).rejects.toThrow('The scan stopped before it finished.');
  });

  it('cancels the body when the caller’s function throws', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(END));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(
      readScan(stream, () => {
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    expect(cancelled).toBe(true);
  });
});
