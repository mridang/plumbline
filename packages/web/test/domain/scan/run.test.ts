import { describe, expect, it } from '@jest/globals';

import { NDJSON, runOnServer, ScannerError } from '@/domain/scan/run';

/** A namespace whose scanner answers with `answer`, noting what it was asked. */
function scanner(answer: () => Response, seen: Request[] = []) {
  return {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (request: Request) => {
        seen.push(request);
        return answer();
      },
    }),
  };
}

describe('runOnServer', () => {
  it('asks the scanner to run the address and returns its stream', async () => {
    const seen: Request[] = [];
    const response = await runOnServer(
      scanner(() => new Response('{"type":"end"}\n'), seen),
      'https://example.com/',
    );
    expect(response.headers.get('content-type')).toBe(NDJSON);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('{"type":"end"}\n');
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0]?.url ?? '').pathname).toBe('/run');
    expect(await seen[0]?.json()).toEqual({ url: 'https://example.com/' });
  });

  it('passes the caller’s signal on, so the scan stops when the caller goes', async () => {
    const seen: Request[] = [];
    const controller = new AbortController();
    await runOnServer(
      scanner(() => new Response('x'), seen),
      'https://example.com/',
      controller.signal,
    );
    controller.abort();
    expect(seen[0]?.signal.aborted).toBe(true);
  });

  it('throws when there is no scanner', async () => {
    await expect(
      runOnServer(undefined, 'https://example.com/'),
    ).rejects.toBeInstanceOf(ScannerError);
  });

  it.each([
    ['answers with an error', () => new Response('no', { status: 503 })],
    ['answers without a body', () => new Response(null, { status: 200 })],
  ])('throws when the scanner %s', async (_label, answer) => {
    await expect(
      runOnServer(scanner(answer), 'https://example.com/'),
    ).rejects.toBeInstanceOf(ScannerError);
  });
});
