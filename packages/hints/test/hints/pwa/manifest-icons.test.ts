import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/pwa/manifest-icons.js';
import { runHint } from '../../helpers/run-hint.js';

const MANIFEST_PATH = '/m.webmanifest';

function routes(
  icons: unknown[],
): Record<string, { headers: Record<string, string>; body: string }> {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine title</title><link rel="manifest" href="${MANIFEST_PATH}"></head><body><h1>Hi</h1></body></html>`,
    },
    [MANIFEST_PATH]: {
      headers: { 'content-type': 'application/manifest+json' },
      body: JSON.stringify({ name: 'Ex', icons }),
    },
  };
}

describe('manifest-icons', () => {
  it('passes with a 192 and a 512 PNG', async () => {
    expect(
      await runHint(
        hint,
        routes([
          { src: 'a.png', sizes: '192x192', type: 'image/png' },
          { src: 'b.png', sizes: '512x512', type: 'image/png' },
        ]),
      ),
    ).toEqual([]);
  });

  it('errors for both missing sizes', async () => {
    const problems = await runHint(hint, routes([]));
    expect(problems).toHaveLength(2);
    expect(problems.map((p) => p.message).join('\n')).toContain('192x192');
    expect(problems.map((p) => p.message).join('\n')).toContain('512x512');
  });

  it('does nothing when the page links no manifest', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });
});
