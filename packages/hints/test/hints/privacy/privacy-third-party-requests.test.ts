import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-third-party-requests.js';
import { runHint } from '../../helpers/run-hint.js';

/**
 * The test server answers on 127.0.0.1; `localhost` reaches the same server
 * but is a different registrable domain, so it stands in for a third party
 * without touching the internet.
 */
const page = (body: (thirdParty: string, own: string) => string) => ({
  '/': (req: { headers: { host?: string } }) => {
    const host = req.headers.host ?? '';
    const port = host.split(':', 2)[1];
    return {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>t</title></head><body>${body(
        `http://localhost:${port}`,
        `http://${host}`,
      )}</body></html>`,
    };
  },
});

describe('privacy-third-party-requests', () => {
  it('passes when there are no third-party requests', async () => {
    expect(
      await runHint(
        hint,
        page((_t, own) => `<img src="${own}/a.png">`),
      ),
    ).toEqual([]);
  });

  it('lists third-party hosts, counts and types', async () => {
    const problems = await runHint(
      hint,
      page(
        (t) =>
          `<img src="${t}/a.png"><img src="${t}/b.png"><script src="${t}/c.js"></script>`,
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('3 third-party requests');
    expect(problems[0].message).toContain('0 secure, 3 insecure');
    expect(problems[0].message).toContain('1 unique host: localhost');
    expect(problems[0].message).toContain('script: 1, image: 2');
    expect(problems[0].sourceCode).toBe('localhost: 3');
  });
});
