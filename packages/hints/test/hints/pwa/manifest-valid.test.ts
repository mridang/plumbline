import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/pwa/manifest-valid.js';
import { runHint } from '../../helpers/run-hint.js';

const MANIFEST_PATH = '/m.webmanifest';

const VALID = JSON.stringify({
  name: 'Example',
  short_name: 'Ex',
  start_url: '/',
  display: 'standalone',
  theme_color: '#ffffff',
  background_color: '#000000',
  id: '/',
  scope: '/',
  description: 'An example app',
  shortcuts: [{ name: 'Home', url: '/' }],
  screenshots: [{ src: 's.png' }],
  icons: [{ src: 'i.png', sizes: '192x192', type: 'image/png' }],
});

/** A page that links the manifest, plus a route serving `body` as the manifest. */
function routes(
  body: string,
  contentType = 'application/manifest+json',
): Record<string, { headers: Record<string, string>; body: string }> {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine title</title><link rel="manifest" href="${MANIFEST_PATH}"></head><body><h1>Hi</h1></body></html>`,
    },
    [MANIFEST_PATH]: {
      headers: { 'content-type': contentType },
      body,
    },
  };
}

describe('manifest-valid', () => {
  it('passes a complete, correctly served manifest', async () => {
    expect(await runHint(hint, routes(VALID))).toEqual([]);
  });

  it('does nothing when the page links no manifest', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('errors when the manifest body is not valid JSON', async () => {
    const problems = await runHint(hint, routes('not json'));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not valid JSON');
  });

  it('warns when the manifest is served with the wrong media type', async () => {
    const problems = await runHint(hint, routes(VALID, 'application/json'));
    expect(
      problems.some((p) => p.message.includes('application/manifest+json')),
    ).toBe(true);
  });

  it('errors on each missing required member', async () => {
    const body = JSON.stringify({
      short_name: 'Ex',
      icons: [{ src: 'i.png' }],
    });
    const problems = await runHint(hint, routes(body));
    const messages = problems.map((p) => p.message).join('\n');
    expect(messages).toContain('no "start_url"');
    expect(messages).toContain('no "display"');
    expect(messages).toContain('no "theme_color"');
    expect(messages).toContain('no "background_color"');
  });
});
