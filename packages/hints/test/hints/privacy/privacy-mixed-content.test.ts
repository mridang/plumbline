import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-mixed-content.js';
import { runHint } from '../../helpers/run-hint.js';

// The test server only speaks http, so mixed content itself is covered in
// test/lib/privacy/requests.test.ts; an http page has none by definition.
describe('privacy-mixed-content', () => {
  it('does not report http subresources on an http page', async () => {
    const problems = await runHint(hint, {
      '/': (req) => ({
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: `<!doctype html><html lang="en"><head><title>t</title></head><body><script src="http://${req.headers.host}/a.js"></script><img src="http://localhost/a.png"></body></html>`,
      }),
    });
    expect(problems).toEqual([]);
  });

  it('ignores malformed URLs in the markup', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<!doctype html><html lang="en"><head><title>t</title></head><body><video src="http://"></video></body></html>',
      },
    });
    expect(problems).toEqual([]);
  });
});
