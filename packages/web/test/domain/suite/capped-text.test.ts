import { describe, expect, it, jest } from '@jest/globals';

import { readTextCapped } from '@/domain/suite/capped-text';

/** A response whose body arrives in the given pieces. */
function inPieces(...pieces: string[]): Response {
  const encoder = new TextEncoder();
  let at = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = pieces[at];
        at += 1;
        if (next === undefined) {
          controller.close();
        } else {
          controller.enqueue(encoder.encode(next));
        }
      },
    }),
  );
}

describe('readTextCapped', () => {
  it('reads a body that fits, whole', async () => {
    expect(await readTextCapped(inPieces('hello ', 'world'), 100)).toEqual({
      text: 'hello world',
      truncated: false,
    });
  });

  it('reads a body of exactly the limit without cutting it', async () => {
    expect(await readTextCapped(inPieces('12345'), 5)).toEqual({
      text: '12345',
      truncated: false,
    });
  });

  it('keeps the first bytes of a body that is too long, and says so', async () => {
    expect(await readTextCapped(inPieces('abc', 'defgh', 'ijk'), 6)).toEqual({
      text: 'abcdef',
      truncated: true,
    });
  });

  it('drops the connection instead of reading on', async () => {
    const response = inPieces('abcdef', 'ghi', 'jkl');
    const cancel = jest.spyOn(ReadableStreamDefaultReader.prototype, 'cancel');
    await readTextCapped(response, 3);
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });

  it('reads an empty body, and a response with no body at all', async () => {
    expect(await readTextCapped(inPieces(), 10)).toEqual({
      text: '',
      truncated: false,
    });
    expect(
      await readTextCapped(new Response(null, { status: 204 }), 10),
    ).toEqual({ text: '', truncated: false });
  });

  it('decodes multi-byte text', async () => {
    const capped = await readTextCapped(inPieces('héllo ✓'), 100);
    expect(capped.text).toBe('héllo ✓');
  });
});
