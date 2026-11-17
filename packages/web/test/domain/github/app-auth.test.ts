import { describe, expect, it, jest } from '@jest/globals';
import { decodeJwt, decodeProtectedHeader } from 'jose';

import { appJwt, installationToken } from '@/domain/github/app-auth';

import { generateKeyPairAsync } from '../../helpers/crypto';

/** Matches a bearer authorization header carrying a signed token. */
const BEARER_JWT_PATTERN = /^Bearer ey/u;

const { privateKey } = await generateKeyPairAsync('rsa', {
  modulusLength: 2048,
});
const config = {
  appId: '123',
  privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
};

describe('appJwt', () => {
  it('is an RS256 token issued by the app, valid for under ten minutes', async () => {
    const token = await appJwt(config, 1_000_000);
    expect(decodeProtectedHeader(token).alg).toBe('RS256');
    expect(decodeJwt(token)).toMatchObject({
      iss: '123',
      iat: 1_000_000 - 60,
      exp: 1_000_000 + 540,
    });
  });
});

describe('installationToken', () => {
  it('trades the JWT for an installation token', async () => {
    const fetcher = jest.fn(async (_url: unknown, init?: RequestInit) => {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the test reads this value as Record<string, string>, which the values it was built from or the checks around it establish
        String((init?.headers as Record<string, string>)['Authorization']),
      ).toMatch(BEARER_JWT_PATTERN);
      return Response.json({ token: 'ghs_abc' });
    });
    expect(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns any, and the test reads the parsed text as the shape its fixture wrote
      await installationToken(config, 42, fetcher as unknown as typeof fetch),
    ).toBe('ghs_abc');
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/app/installations/42/access_tokens',
    );
  });

  it('fails with the status when GitHub refuses', async () => {
    const fetcher = async () => new Response('no', { status: 404 });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns any, and the test reads the parsed text as the shape its fixture wrote
      installationToken(config, 42, fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 404 });
  });
});
