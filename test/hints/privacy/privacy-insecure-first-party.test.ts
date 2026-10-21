import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-insecure-first-party.js';
import { runHint } from '../../helpers/run-hint.js';

// The test server only speaks http, so every first-party subresource is a
// plain http request; Webbkoll lists those whatever the page's scheme.
describe('privacy-insecure-first-party', () => {
  it('passes without first-party subresources', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports plain http first-party requests', async () => {
    const problems = await runHint(hint, {
      '/': (req) => ({
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: `<!doctype html><html lang="en"><head><title>t</title></head><body><img src="http://${req.headers.host}/a.png"></body></html>`,
      }),
      '/a.png': { headers: { 'content-type': 'image/png' }, body: 'x' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('/a.png');
    expect(problems[0].resource).toMatch(/\/a\.png$/);
    expect(problems[0].sourceCode).toContain('<img src="http://');
    expect(problems[0].sourceCode).toContain('/a.png');
    expect(problems[0].location.line).toBe(0);
  });
});
