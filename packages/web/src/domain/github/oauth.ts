/**
 * @packageDocumentation
 *
 * Proving who a GitHub user is, with the app's OAuth flow. This is how a
 * Google account and a GitHub account are tied together: the person is
 * already signed in with Google, so whoever completes this flow in that
 * session is the GitHub user the app links to them. The access token is used
 * for the three reads below and then dropped; it is never stored.
 */

import { z } from 'zod';

import { GitHubApi } from './api';
import type { GitHubConfig } from './config';

/** What GitHub says about the person. */
export interface GitHubIdentity {
  readonly id: number;
  readonly login: string;
  /** The name and picture on their GitHub profile, when they have them. */
  readonly name: string | null;
  readonly picture: string | null;
  /** The installations of the app that the person can reach. */
  readonly installations: readonly {
    readonly id: number;
    readonly account: string;
  }[];
}

/** The address that sends the browser to GitHub to approve the app. */
export function authorizeUrl(
  config: Pick<GitHubConfig, 'clientId'>,
  redirectUri: string,
  state: string,
): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/** The address that sends the browser to install the app, coming back with `state`. */
export function installUrl(
  config: Pick<GitHubConfig, 'slug'>,
  state: string,
): string {
  const url = new URL(
    `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`,
  );
  url.searchParams.set('state', state);
  return url.toString();
}

/** Trade the code GitHub handed back for the person's access token. */
export async function exchangeCode(
  config: Pick<GitHubConfig, 'clientId' | 'clientSecret'>,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub refused the sign-in code (${response.status})`);
  }
  const body = z
    .object({ access_token: z.string().optional() })
    .safeParse(await response.json());
  if (!body.success || !body.data.access_token) {
    throw new Error('GitHub answered without an access token');
  }
  return body.data.access_token;
}

/** Who the token belongs to, with the installations of the app they can reach. */
export async function identify(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<GitHubIdentity> {
  const api = new GitHubApi(accessToken, fetcher);
  const [user, installations] = await Promise.all([
    api.json(
      '/user',
      z.object({
        id: z.number().int(),
        login: z.string(),
        name: z.string().nullish(),
        avatar_url: z.string().nullish(),
      }),
    ),
    api.list(
      '/user/installations',
      z.object({
        installations: z.array(
          z.object({
            id: z.number().int(),
            account: z.object({ login: z.string() }).nullish(),
          }),
        ),
      }),
      (page) => page.installations,
    ),
  ]);
  return {
    id: user.id,
    login: user.login,
    name: user.name ?? null,
    picture: user.avatar_url ?? null,
    installations: installations.map((i) => ({
      id: i.id,
      account: i.account?.login ?? user.login,
    })),
  };
}

/**
 * The repositories of the app's installations that the person can reach, as
 * GitHub says now, with the access token they signed in with: what a
 * person may see is what GitHub lets them see, not something this app decides.
 * Archived repositories are left out, since nothing is deployed from them.
 */
export async function accessibleRepositories(
  accessToken: string,
  installations: readonly { readonly id: number }[],
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const api = new GitHubApi(accessToken, fetcher);
  const lists = await Promise.all(
    installations.map((installation) =>
      api.list(
        `/user/installations/${installation.id}/repositories`,
        z.object({
          repositories: z.array(
            z.object({
              full_name: z.string(),
              archived: z.boolean().nullish(),
            }),
          ),
        }),
        (page) => page.repositories,
      ),
    ),
  );
  return [
    ...new Set(
      lists
        .flat()
        .filter((repo) => !repo.archived)
        .map((repo) => repo.full_name),
    ),
  ];
}
