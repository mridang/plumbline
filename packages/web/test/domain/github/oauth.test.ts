import { describe, expect, it } from '@jest/globals';

import {
  authorizeUrl,
  exchangeCode,
  identify,
  installUrl,
} from '@/domain/github/oauth';

/** A fetch that answers by the start of the address. */
function fetchOf(
  answers: Record<string, () => Response>,
  seen: string[] = [],
): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    seen.push(`${init?.method ?? 'GET'} ${url}`);
    const key = Object.keys(answers).find((prefix) => url.startsWith(prefix));
    if (!key) {
      throw new Error(`unexpected ${url}`);
    }
    return answers[key]!();
  }) as typeof fetch;
}

describe('authorizeUrl and installUrl', () => {
  it('send the browser to GitHub with the state', () => {
    const authorize = new URL(
      authorizeUrl(
        { clientId: 'cid' },
        'https://p.test/api/github/callback',
        's1',
      ),
    );
    expect(authorize.origin + authorize.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(authorize.searchParams.get('client_id')).toBe('cid');
    expect(authorize.searchParams.get('redirect_uri')).toBe(
      'https://p.test/api/github/callback',
    );
    expect(authorize.searchParams.get('state')).toBe('s1');

    const install = new URL(installUrl({ slug: 'plumb line' }, 's2'));
    expect(install.pathname).toBe('/apps/plumb%20line/installations/new');
    expect(install.searchParams.get('state')).toBe('s2');
  });
});

describe('exchangeCode', () => {
  const config = { clientId: 'cid', clientSecret: 'sec' };

  it('trades the code for the access token', async () => {
    const token = await exchangeCode(
      config,
      'code',
      fetchOf({
        'https://github.com/login/oauth/access_token': () =>
          Response.json({ access_token: 'gho_1' }),
      }),
    );
    expect(token).toBe('gho_1');
  });

  it('fails when GitHub refuses or answers without a token', async () => {
    const url = 'https://github.com/login/oauth/access_token';
    await expect(
      exchangeCode(
        config,
        'c',
        fetchOf({ [url]: () => new Response('no', { status: 500 }) }),
      ),
    ).rejects.toThrow('500');
    await expect(
      exchangeCode(
        config,
        'c',
        fetchOf({
          [url]: () => Response.json({ error: 'bad_verification_code' }),
        }),
      ),
    ).rejects.toThrow('without an access token');
  });
});

describe('identify', () => {
  it('reads who the token belongs to and the installations they can reach', async () => {
    const identity = await identify(
      'gho_1',
      fetchOf({
        'https://api.github.com/user/installations': () =>
          Response.json({
            installations: [
              { id: 5, account: { login: 'acme' } },
              { id: 6, account: null },
            ],
          }),
        'https://api.github.com/user': () =>
          Response.json({ id: 9, login: 'mridang' }),
      }),
    );
    expect(identity).toEqual({
      id: 9,
      login: 'mridang',
      installations: [
        { id: 5, account: 'acme' },
        { id: 6, account: 'mridang' },
      ],
    });
  });
});
