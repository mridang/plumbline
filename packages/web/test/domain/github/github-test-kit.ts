import { createHmac, generateKeyPairSync } from 'node:crypto';

import { jest } from '@jest/globals';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** The GitHub App's settings in the Worker environment. */
export const GITHUB_ENV = {
  GITHUB_APP_ID: '123',
  GITHUB_APP_SLUG: 'plumbline-test',
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  GITHUB_PRIVATE_KEY: privateKey
    .export({ type: 'pkcs1', format: 'pem' })
    .toString(),
  GITHUB_WEBHOOK_SECRET: 'hook-secret',
};

/** The signature GitHub would put on a delivery body. */
export function signed(
  body: string,
  secret = GITHUB_ENV.GITHUB_WEBHOOK_SECRET,
): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * Answer every `fetch` the code under test makes to GitHub, by the start of the
 * address (the first matching entry wins). A request nobody answers for throws.
 * Returns the addresses requested, as `METHOD url`.
 */
export function fakeGitHub(
  answers: Readonly<Record<string, () => Response>>,
): string[] {
  const requested: string[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    requested.push(`${init?.method ?? 'GET'} ${url}`);
    const key = Object.keys(answers).find((prefix) => url.startsWith(prefix));
    if (!key) {
      throw new Error(`Unexpected request in a test: ${url}`);
    }
    return answers[key]!();
  });
  return requested;
}

/** The answers of a GitHub where installation 5 of `acme` has one deployed repository. */
export const DEPLOYED_APP: Readonly<Record<string, () => Response>> = {
  'https://github.com/login/oauth/access_token': () =>
    Response.json({ access_token: 'gho_1' }),
  'https://api.github.com/user/installations/5/repositories': () =>
    Response.json({
      repositories: [
        { full_name: 'acme/site', archived: false },
        { full_name: 'acme/old', archived: true },
      ],
    }),
  'https://api.github.com/user/installations': () =>
    Response.json({ installations: [{ id: 5, account: { login: 'acme' } }] }),
  'https://api.github.com/user': () =>
    Response.json({ id: 9, login: 'mridang' }),
  'https://api.github.com/app/installations/5/access_tokens': () =>
    Response.json({ token: 'ghs_1' }),
  'https://api.github.com/installation/repositories': () =>
    Response.json({
      repositories: [{ full_name: 'acme/site', default_branch: 'main' }],
    }),
  'https://api.github.com/repos/acme/site/git/trees': () =>
    Response.json({ tree: [{ path: 'wrangler.jsonc', type: 'blob' }] }),
  'https://api.github.com/repos/acme/site/contents': () =>
    new Response('{"route": "site.example.com/*"}'),
};
