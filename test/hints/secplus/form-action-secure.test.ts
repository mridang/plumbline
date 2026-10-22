import { describe, expect, it } from '@jest/globals';
import { runHint } from '../../helpers/run-hint.js';
import formActionSecure from '../../../src/hints/secplus/form-action-secure.js';

/**
 * The local scan harness serves the page over plain HTTP, and the rule is
 * out of scope on a non-HTTPS page (the page itself should be on HTTPS first).
 * So these hint tests exercise the wiring and the safe paths; the insecure-form
 * detection itself is covered by `test/lib/secplus/form-action.test.ts` (the
 * exact function this hint calls) and by the Lighthouse check test, which can
 * drive an HTTPS page URL.
 */
function page(body: string): string {
  return `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;
}

describe('the form-action-secure hint', () => {
  it('does not fire on an HTTP page (out of scope)', async () => {
    const problems = await runHint(formActionSecure, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page('<form action="http://example.test/submit"></form>'),
      },
    });
    expect(problems).toHaveLength(0);
  });

  it('passes a page with a relative form action', async () => {
    const problems = await runHint(formActionSecure, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page('<form action="/submit"></form>'),
      },
    });
    expect(problems).toHaveLength(0);
  });

  it('passes a page with no forms', async () => {
    const problems = await runHint(formActionSecure);
    expect(problems).toHaveLength(0);
  });
});
