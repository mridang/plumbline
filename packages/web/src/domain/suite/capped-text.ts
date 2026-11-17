/**
 * @packageDocumentation
 *
 * Reading the text of a response without trusting its size. A page or a file
 * someone else controls can be any length, and a Worker has 128 MB of memory,
 * so the body is read in pieces and cut off, with the connection dropped, once
 * it passes the limit.
 */

/** What reading a body gave. */
export interface CappedText {
  /** At most `maxBytes` of the body, decoded as UTF-8. */
  readonly text: string;
  /** Whether the body was longer than `maxBytes`. */
  readonly truncated: boolean;
}

/** The text of `response`, at most `maxBytes` bytes of it. */
export async function readTextCapped(
  response: Response,
  maxBytes: number,
): Promise<CappedText> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: '', truncated: false };
  }
  /** Reads the body piece by piece until it ends or passes `maxBytes`. */
  const collect = async (
    chunks: readonly Uint8Array[],
    size: number,
  ): Promise<{ chunks: readonly Uint8Array[]; truncated: boolean }> => {
    const { done, value } = await reader.read();
    if (done) {
      return { chunks, truncated: false };
    }
    if (size + value.byteLength > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return {
        chunks: [...chunks, value.subarray(0, maxBytes - size)],
        truncated: true,
      };
    }
    return collect([...chunks, value], size + value.byteLength);
  };
  const { chunks, truncated } = await collect([], 0);
  const whole = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  chunks.reduce((at, chunk) => {
    whole.set(chunk, at);
    return at + chunk.byteLength;
  }, 0);
  return { text: new TextDecoder().decode(whole), truncated };
}
