/**
 * @packageDocumentation
 *
 * Acting as the GitHub App: a short-lived JWT signed with the app's private
 * key proves who the app is, and trades for an installation access token that
 * can read the repositories that installation was granted.
 */

import { SignJWT, importPKCS8 } from 'jose';
import { z } from 'zod';

import type { GitHubConfig } from './config';
import { GitHubError } from './api';
import { toPkcs8 } from './pkcs8';

/** GitHub allows a JWT to live ten minutes at most; this leaves room for clock drift. */
const LIFETIME_SECONDS = 540;

/** The app's JWT, valid for the next few minutes. */
export async function appJwt(
  config: Pick<GitHubConfig, 'appId' | 'privateKey'>,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const key = await importPKCS8(toPkcs8(config.privateKey), 'RS256');
  return (
    new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(config.appId)
      // A minute back covers a clock that runs ahead of GitHub's.
      .setIssuedAt(nowSeconds - 60)
      .setExpirationTime(nowSeconds + LIFETIME_SECONDS)
      .sign(key)
  );
}

/** An installation access token (valid for an hour). */
export async function installationToken(
  config: Pick<GitHubConfig, 'appId' | 'privateKey'>,
  installationId: number,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await appJwt(config)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plumbline',
      },
    },
  );
  if (!response.ok) {
    throw new GitHubError(
      `GitHub refused an installation token (${response.status})`,
      response.status,
    );
  }
  return z.object({ token: z.string() }).parse(await response.json()).token;
}
