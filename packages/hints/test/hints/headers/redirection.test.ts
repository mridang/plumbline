import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/redirection.js';
import { redirectionClient } from '../../../src/lib/headers/redirection.js';
import { Severity } from '@hint/utils-types';
import { runHint } from '../../helpers/run-hint.js';

const original = redirectionClient.fetch;

/**
 * Replaces the client with a fake. `plan` receives the URL asked for and
 * the hop number and answers with [status, location] or an error.
 */
function fakeSite(
  plan: (url: URL, hop: number) => [number, string?] | Error,
): string[] {
  const asked: string[] = [];
  redirectionClient.fetch = (url) => {
    const answer = plan(new URL(url), asked.length);
    asked.push(url);
    if (answer instanceof Error) {
      return Promise.reject(answer);
    }
    const [status, location] = answer;
    return Promise.resolve(
      new Response(null, { status, headers: location ? { location } : {} }),
    );
  };
  return asked;
}

describe('redirection', () => {
  afterEach(() => {
    redirectionClient.fetch = original;
  });

  it('passes when http redirects to https on the same host', async () => {
    const asked = fakeSite((url, hop) =>
      hop === 0 ? [301, `https://${url.host}/`] : [200],
    );
    expect(await runHint(hint, {})).toEqual([]);
    expect(asked[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it('passes when http is not reachable', async () => {
    fakeSite(() => new Error('connection refused'));
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a site that stays on http', async () => {
    fakeSite(() => [200]);
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toMatch(
      /^200 http:\/\/127\.0\.0\.1:\d+\/$/,
    );
    expect(problems[0]?.message).toContain(
      'Does not redirect to an HTTPS site',
    );
  });

  it('reports a final destination that is not https', async () => {
    fakeSite((url, hop) =>
      hop === 0 ? [302, 'http://other.example/'] : [200],
    );
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain(
      'final destination is not an HTTPS URL',
    );
  });

  it('reports an initial redirect to another http URL', async () => {
    fakeSite((url, hop) => {
      if (hop === 0) {
        return [301, 'http://www.example.test/'];
      }
      return hop === 1 ? [301, 'https://www.example.test/'] : [200];
    });
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain(
      'initial redirection is to another HTTP URL',
    );
  });

  it('warns about a first redirect to a different host', async () => {
    fakeSite((url, hop) =>
      hop === 0 ? [301, 'https://www.example.test/'] : [200],
    );
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain('different host, preventing HSTS');
    expect(problems[0]?.severity).toBe(Severity.warning);
  });

  it('reports an invalid certificate on the https hop', async () => {
    fakeSite((url, hop) =>
      hop === 0
        ? [301, 'https://127.0.0.1/']
        : Object.assign(new Error('bad'), {
            code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
          }),
    );
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain('Invalid certificate chain');
  });
});
