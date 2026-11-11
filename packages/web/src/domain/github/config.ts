/**
 * @packageDocumentation
 *
 * The GitHub App's settings, read from the Worker's environment. The feature
 * is off until every one is set: a deployment without a GitHub App just does
 * not offer it, and nothing else about the site changes.
 */

/** What the app needs to act as the GitHub App and as a person signing in. */
export interface GitHubConfig {
  /** The app's numeric id (signs the JWT that mints installation tokens). */
  readonly appId: string;
  /** The app's URL name, as in `github.com/apps/<slug>`. */
  readonly slug: string;
  /** The app's OAuth client id and secret (proves who a GitHub user is). */
  readonly clientId: string;
  readonly clientSecret: string;
  /** The app's private key (PKCS#1 or PKCS#8 PEM). */
  readonly privateKey: string;
  /** The secret GitHub signs webhook deliveries with. */
  readonly webhookSecret: string;
}

/** The environment names the settings come from. */
export interface GitHubEnv {
  readonly GITHUB_APP_ID?: string;
  readonly GITHUB_APP_SLUG?: string;
  readonly GITHUB_CLIENT_ID?: string;
  readonly GITHUB_CLIENT_SECRET?: string;
  readonly GITHUB_PRIVATE_KEY?: string;
  readonly GITHUB_WEBHOOK_SECRET?: string;
}

/** The settings, or null when any is missing. */
export function readGitHubConfig(
  env: Readonly<GitHubEnv>,
): GitHubConfig | null {
  const {
    GITHUB_APP_ID: appId,
    GITHUB_APP_SLUG: slug,
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    GITHUB_PRIVATE_KEY: privateKey,
    GITHUB_WEBHOOK_SECRET: webhookSecret,
  } = env;
  if (!appId || !slug || !clientId) {
    return null;
  }
  if (!clientSecret || !privateKey || !webhookSecret) {
    return null;
  }
  return { appId, slug, clientId, clientSecret, privateKey, webhookSecret };
}
