/**
 * @packageDocumentation
 *
 * The typed database schema — the single source of truth every repository
 * composes queries against. Column names and JS keys are kept identical
 * (snake_case) so query results line up with the row types.
 *
 * The hand-written SQL migrations in `/migrations` remain authoritative;
 * this file mirrors their result so Drizzle can type the queries. Keep it
 * in sync when adding a migration (it matches the live D1 exactly).
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * One row per signed-in Google account. `google_sub` is Google's stable,
 * opaque user id (the OpenID `sub` claim) — the real identity key, since an
 * email can be reassigned but `sub` never changes.
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  google_sub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  picture: text('picture'),
  /**
   * Which generation of sessions is valid. A session cookie carries the epoch
   * it was issued under and is honoured only while it equals this value, so
   * bumping it signs the person out everywhere at once.
   */
  session_epoch: integer('session_epoch').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

/**
 * A site a person keeps an eye on, unique per (person, host). `checks` is a
 * JSON array of the check ids chosen for it, or null for every check.
 */
export const domains = sqliteTable(
  'domains',
  {
    id: text('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    host: text('host').notNull(),
    checks: text('checks'),
    /** `owner/name` of the repository the domain was found in; null when added by hand. */
    repo: text('repo'),
    /** When the domain was last checked on the server; the empty string when never. */
    checked_at: text('checked_at').notNull().default(''),
    /** When the check that is running now began; null when none is. */
    checking_since: text('checking_since'),
    /** What the last check found; null before the first. */
    errors: integer('errors'),
    warnings: integer('warnings'),
    hints: integer('hints'),
    /** Whether the last check could reach the site (1) or not (0). */
    reachable: integer('reachable').notNull().default(1),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('sqlite_autoindex_domains_2').on(table.user_id, table.host),
    index('idx_domains_user_created').on(
      table.user_id,
      table.created_at,
      table.id,
    ),
    index('idx_domains_due')
      .on(table.checked_at)
      .where(sql`${table.repo} IS NOT NULL`),
    index('idx_domains_repo')
      .on(table.repo)
      .where(sql`${table.repo} IS NOT NULL`),
  ],
);

/**
 * The outcome of one scan of a domain: the address that was scanned, how many
 * checks passed, warned, failed and were skipped, and every check's outcome as
 * a JSON array.
 */
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    domain_id: text('domain_id').notNull(),
    user_id: integer('user_id').notNull(),
    url: text('url').notNull(),
    passed: integer('passed').notNull(),
    warned: integer('warned').notNull(),
    failed: integer('failed').notNull(),
    skipped: integer('skipped').notNull(),
    outcomes: text('outcomes').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    index('idx_reports_domain_page').on(
      table.domain_id,
      sql`${table.created_at} DESC`,
      sql`${table.id} DESC`,
    ),
  ],
);

/**
 * OAuth clients (assistants allowed to ask for access). `kind` is `dcr` for a
 * dynamically registered client or `cimd` for one resolved from a Client ID
 * Metadata Document (cached; `fetched_at` says how fresh). `redirect_uris` is a
 * JSON array.
 */
export const oauthClients = sqliteTable('oauth_clients', {
  client_id: text('client_id').primaryKey(),
  kind: text('kind').notNull(),
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(),
  created_at: text('created_at').notNull(),
  fetched_at: text('fetched_at'),
  /** Until when a fetched document may be reused (from its cache headers); null for older rows and registered clients. */
  expires_at: text('expires_at'),
  /** How the client proves itself at the token endpoint: `none` (PKCE only) or `private_key_jwt`. */
  auth_method: text('auth_method').notNull().default('none'),
  /** Where the client publishes the keys it signs assertions with; set only for `private_key_jwt`. */
  jwks_uri: text('jwks_uri'),
  /** The picture the client publishes for itself; set only for a client fetched from its metadata document. */
  logo_uri: text('logo_uri'),
});

/** Client assertions already accepted (by `jti`), kept until they expire so none is used twice. */
export const oauthAssertions = sqliteTable(
  'oauth_assertions',
  {
    client_id: text('client_id').notNull(),
    jti: text('jti').notNull(),
    expires_at: integer('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.client_id, table.jti] }),
    index('idx_oauth_assertions_expires').on(table.expires_at),
  ],
);

/** One user's approval of one client; revoking it revokes all its tokens. */
export const oauthGrants = sqliteTable(
  'oauth_grants',
  {
    id: text('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    client_id: text('client_id').notNull(),
    scope: text('scope').notNull(),
    resource: text('resource').notNull(),
    created_at: text('created_at').notNull(),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
  },
  (table) => [
    index('idx_oauth_grants_user').on(table.user_id),
    index('idx_oauth_grants_user_client').on(table.user_id, table.client_id),
    index('idx_oauth_grants_client').on(table.client_id),
  ],
);

/** Single-use authorization codes (hashed). `grant_id` is set once redeemed. */
export const oauthCodes = sqliteTable(
  'oauth_codes',
  {
    code_hash: text('code_hash').primaryKey(),
    client_id: text('client_id').notNull(),
    user_id: integer('user_id').notNull(),
    redirect_uri: text('redirect_uri').notNull(),
    /** Whether the authorization request carried `redirect_uri` (the token request must then repeat it). */
    redirect_uri_sent: integer('redirect_uri_sent', { mode: 'boolean' })
      .notNull()
      .default(true),
    code_challenge: text('code_challenge').notNull(),
    scope: text('scope').notNull(),
    resource: text('resource').notNull(),
    expires_at: integer('expires_at').notNull(),
    grant_id: text('grant_id'),
  },
  (table) => [index('idx_oauth_codes_expires').on(table.expires_at)],
);

/** Access and refresh tokens, stored only as SHA-256 hashes. */
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    token_hash: text('token_hash').primaryKey(),
    kind: text('kind').notNull(),
    grant_id: text('grant_id').notNull(),
    expires_at: integer('expires_at').notNull(),
    used_at: integer('used_at'),
  },
  (table) => [
    index('idx_oauth_tokens_grant').on(table.grant_id),
    index('idx_oauth_tokens_expires').on(table.expires_at),
  ],
);

/**
 * The GitHub account a signed-in person connected. `github_id` is GitHub's
 * stable user id, unique, so one GitHub account is linked to one person.
 */
export const githubLinks = sqliteTable('github_links', {
  user_id: integer('user_id').primaryKey(),
  github_id: integer('github_id').notNull().unique(),
  login: text('login').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

/** An installation of the GitHub App, owned by the person who linked it. */
export const githubInstallations = sqliteTable(
  'github_installations',
  {
    installation_id: integer('installation_id').primaryKey(),
    user_id: integer('user_id').notNull(),
    account_login: text('account_login').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [index('idx_github_installations_user').on(table.user_id)],
);

/** A repository of an installation, with the hosts it is deployed on (a JSON array). */
export const githubRepos = sqliteTable(
  'github_repos',
  {
    installation_id: integer('installation_id').notNull(),
    full_name: text('full_name').notNull(),
    user_id: integer('user_id').notNull(),
    default_branch: text('default_branch').notNull(),
    hosts: text('hosts').notNull(),
    analysed_at: text('analysed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.installation_id, table.full_name] }),
    index('idx_github_repos_user').on(table.user_id, table.full_name),
  ],
);

/**
 * One server-side run of the checks on a host, started by a deployment.
 * `findings` is a JSON array of `{ id, severity, message }`.
 */
export const suiteRuns = sqliteTable(
  'suite_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id').notNull(),
    host: text('host').notNull(),
    repo: text('repo'),
    sha: text('sha'),
    status: integer('status').notNull(),
    /** SHA-256 of the response the run read; null for a run from before it was kept. */
    hash: text('hash'),
    /** Fingerprint of the rules the run applied; null for a run from before it was kept. */
    rules: text('rules'),
    ran_at: text('ran_at').notNull(),
    findings: text('findings').notNull(),
    /** The page's validators, so the next run can ask whether it changed. */
    etag: text('etag'),
    last_modified: text('last_modified'),
    /** Until when the site said the page is fresh; null when it did not. */
    fresh_until: text('fresh_until'),
  },
  (table) => [
    index('idx_suite_runs_host').on(table.user_id, table.host, table.id),
  ],
);

/**
 * What a check on a pull request found, kept under a random id so the check's
 * link opens it, and an agent can read it as JSON, without signing in.
 */
export const previewReports = sqliteTable(
  'preview_reports',
  {
    id: text('id').primaryKey(),
    repo: text('repo').notNull(),
    sha: text('sha').notNull(),
    url: text('url').notNull(),
    errors: integer('errors').notNull(),
    warnings: integer('warnings').notNull(),
    hints: integer('hints').notNull(),
    findings: text('findings').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => [index('idx_preview_reports_created').on(table.created_at)],
);

/** What happened to a person's sites, in order, for the live dashboard to replay. */
export const liveEvents = sqliteTable(
  'live_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id').notNull(),
    payload: text('payload').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => [index('idx_live_events_user').on(table.user_id, table.id)],
);

/** A browser or device a person turned notifications on for. */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    user_id: integer('user_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    created_at: text('created_at').notNull(),
    last_sent_at: text('last_sent_at'),
  },
  (table) => [index('idx_push_subscriptions_user').on(table.user_id)],
);

/**
 * The GitHub issue that reports the problems of one host of one repository.
 * `state` is 'open', 'fixed' (the app closed it) or 'dismissed' (a person
 * closed it); `signature` fingerprints the problems it last reported.
 */
export const suiteIssues = sqliteTable(
  'suite_issues',
  {
    repo: text('repo').notNull(),
    host: text('host').notNull(),
    number: integer('number').notNull(),
    state: text('state').notNull(),
    signature: text('signature').notNull(),
  },
  (table) => [primaryKey({ columns: [table.repo, table.host] })],
);

/** The id GitHub gave a webhook delivery, kept so a retried delivery is not handled twice. */
export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    delivery_id: text('delivery_id').primaryKey(),
    received_at: text('received_at').notNull(),
  },
  (table) => [index('idx_webhook_deliveries_received').on(table.received_at)],
);
