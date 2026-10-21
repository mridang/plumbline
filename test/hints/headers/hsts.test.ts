import { afterEach, describe, expect, it, jest } from '@jest/globals';
import hint from '../../../src/hints/headers/hsts.js';
import { hstsClient } from '../../../src/lib/headers/hsts-client.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (value?: string) => ({
  '/': {
    headers: (value ? { 'strict-transport-security': value } : {}) as Record<
      string,
      string
    >,
  },
});
const owasp = { hintOptions: { profile: 'owasp' } };

describe('hsts', () => {
  const original = hstsClient.fetchHeader;
  afterEach(() => {
    hstsClient.fetchHeader = original;
  });

  it('reports a site that is not served over https', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('not available over HTTPS');
  });

  it('also warns that the header is ignored over http', async () => {
    const problems = await runHint(hint, page('max-age=31536000'));
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringContaining('not available over HTTPS'),
      expect.stringContaining('ignored by browsers'),
    ]);
  });

  it('does not look up the base domain of an IP address', async () => {
    const fetchHeader = jest.fn(async () => null);
    hstsClient.fetchHeader = fetchHeader;
    await runHint(hint, page('max-age=31536000'));
    expect(fetchHeader).not.toHaveBeenCalled();
  });

  it('owasp: passes the recommended values', async () => {
    expect(
      await runHint(hint, page('max-age=63072000; includeSubDomains'), owasp),
    ).toEqual([]);
    expect(
      await runHint(
        hint,
        page('max-age=63072000; includeSubDomains; preload'),
        owasp,
      ),
    ).toEqual([]);
  });

  it('owasp: reports a missing header', async () => {
    const problems = await runHint(hint, page(), owasp);
    expect(problems[0]?.sourceCode).toBe(
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    );
    expect(problems[0]?.message).toContain('not specified');
  });

  it('owasp: reports another max-age or missing includeSubDomains', async () => {
    for (const value of [
      'max-age=31536000; includeSubDomains',
      'max-age=63072000',
    ]) {
      const problems = await runHint(hint, page(value), owasp);
      expect(problems).toHaveLength(1);
      expect(problems[0]?.message).toContain(
        'max-age=63072000; includeSubDomains',
      );
    }
  });
});
