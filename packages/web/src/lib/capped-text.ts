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
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (size + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - size));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const whole = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const chunk of chunks) {
    whole.set(chunk, at);
    at += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(whole), truncated };
}
