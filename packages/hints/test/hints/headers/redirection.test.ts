import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/redirection.js';
import { redirectionClient } from '../../../src/lib/headers/redirection.js';
import { Severity } from '@hint/utils-types';
import { runHint } from '../../helpers/run-hint.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

/** Matches the root URL of the local test server. */
const LOCAL_ROOT_URL = /^http:\/\/127\.0\.0\.1:\d+\/$/;

/** Matches a 200 response line for the root URL of the local test server. */
const LOCAL_ROOT_RESPONSE = /^200 http:\/\/127\.0\.0\.1:\d+\/$/;

const original = redirectionClient.fetch;

/**
 * Replaces the client with a fake. `plan` receives the URL asked for and
 * the hop number and answers with [status, location] or an error.
 */
function fakeSite(
  plan: (url: URL, hop: number) => [number, string?] | Error,
): string[] {
  const asked: string[] = [];
  redirectionClient.fetch = async (url) => {
    const answer = plan(new URL(url), asked.length);
    asked.push(url);
    if (answer instanceof Error) {
      throw answer;
    }
    const [status, location] = answer;
    return new Response(null, {
      status,
      headers: location ? { location } : {},
    });
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
    expect(asked[0]).toMatch(LOCAL_ROOT_URL);
  });

  it('passes when http is not reachable', async () => {
    fakeSite(() => new Error('connection refused'));
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a site that stays on http', async () => {
    fakeSite(() => [200]);
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toMatch(LOCAL_ROOT_RESPONSE);
    expect(problems[0]?.message).toContain(
      'Does not redirect to an HTTPS site',
    );
  });

  it('reports a final destination that is not https', async () => {
    fakeSite((_url, hop) =>
      hop === 0 ? [302, `${HTTP_SCHEME}other.example/`] : [200],
    );
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain(
      'final destination is not an HTTPS URL',
    );
  });

  it('reports an initial redirect to another http URL', async () => {
    fakeSite((_url, hop) => {
      if (hop === 0) {
        return [301, `${HTTP_SCHEME}www.example.test/`];
      }
      return hop === 1 ? [301, 'https://www.example.test/'] : [200];
    });
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain(
      'initial redirection is to another HTTP URL',
    );
  });

  it('warns about a first redirect to a different host', async () => {
    fakeSite((_url, hop) =>
      hop === 0 ? [301, 'https://www.example.test/'] : [200],
    );
    const problems = await runHint(hint, {});
    expect(problems[0]?.message).toContain('different host, preventing HSTS');
    expect(problems[0]?.severity).toBe(Severity.warning);
  });

  it('reports an invalid certificate on the https hop', async () => {
    fakeSite((_url, hop) =>
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
