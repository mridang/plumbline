import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/wellknown/change-password.js';
import { runHint } from '../../helpers/run-hint.js';

const PATH = '/.well-known/change-password';

describe('change-password', () => {
  it('passes when the URL serves a page', async () => {
    const problems = await runHint(hint, {
      [PATH]: { body: '<html><body>Change password</body></html>' },
    });
    expect(problems).toEqual([]);
  });

  it('passes when the URL redirects to a page', async () => {
    const problems = await runHint(hint, {
      // 302 to an absolute URL on the same test host; fetch follows it.
      [PATH]: (req) => ({
        status: 302,
        headers: { location: `http://${req.headers.host}/settings/password` },
      }),
      '/settings/password': { body: 'change your password here' },
    });
    expect(problems).toEqual([]);
  });

  it('warns when the URL is not found', async () => {
    const problems = await runHint(hint, {
      [PATH]: { status: 404, body: 'nope' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTTP 404');
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource).toContain(PATH);
  });

  it('warns on a server error', async () => {
    const problems = await runHint(hint, {
      [PATH]: { status: 500, body: 'boom' },
    });
    expect(problems[0].message).toContain('HTTP 500');
  });
});
