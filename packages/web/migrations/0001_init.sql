-- plumbline's schema. Authoritative; src/domain/db/schema.ts mirrors it.
--
-- users: one row per Google account that has signed in. `google_sub` is
--   Google's stable id for the account; raising `session_epoch` ends every
--   session the person has ("sign out everywhere").
-- domains: a site a person keeps an eye on, with the checks chosen for it.
--   `checks` is a JSON array of check ids, or NULL for every check.
-- reports: the outcome of one scan of a domain, run in the person's browser
--   and saved from there. `outcomes` is a JSON array, one entry per check.
-- oauth_*: the OAuth 2.1 authorization server for the MCP endpoint, the same
--   tables chowdown has (see its migrations 0008, 0012, 0016, 0017, 0018).
-- rate_limits: fixed-window counters for MCP tool calls, client registration
--   and client-metadata fetches.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  name          TEXT,
  picture       TEXT,
  session_epoch INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE domains (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  host       TEXT NOT NULL,
  checks     TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, host)
);

CREATE INDEX idx_domains_user ON domains (user_id, created_at);

CREATE TABLE reports (
  id         TEXT PRIMARY KEY,
  domain_id  TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  url        TEXT NOT NULL,
  passed     INTEGER NOT NULL,
  warned     INTEGER NOT NULL,
  failed     INTEGER NOT NULL,
  skipped    INTEGER NOT NULL,
  outcomes   TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_reports_domain ON reports (domain_id, created_at);

CREATE TABLE oauth_clients (
  client_id     TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  client_name   TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  fetched_at    TEXT,
  expires_at    TEXT,
  auth_method   TEXT NOT NULL DEFAULT 'none',
  jwks_uri      TEXT,
  logo_uri      TEXT
);

CREATE TABLE oauth_assertions (
  client_id  TEXT NOT NULL,
  jti        TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (client_id, jti)
);

CREATE INDEX idx_oauth_assertions_expires ON oauth_assertions (expires_at);

CREATE TABLE oauth_grants (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  client_id    TEXT NOT NULL,
  scope        TEXT NOT NULL,
  resource     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE INDEX idx_oauth_grants_user ON oauth_grants (user_id);
CREATE INDEX idx_oauth_grants_user_client ON oauth_grants (user_id, client_id);
CREATE INDEX idx_oauth_grants_client ON oauth_grants (client_id);

CREATE TABLE oauth_codes (
  code_hash         TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL,
  user_id           INTEGER NOT NULL,
  redirect_uri      TEXT NOT NULL,
  redirect_uri_sent INTEGER NOT NULL DEFAULT 1,
  code_challenge    TEXT NOT NULL,
  scope             TEXT NOT NULL,
  resource          TEXT NOT NULL,
  expires_at        INTEGER NOT NULL,
  grant_id          TEXT
);

CREATE INDEX idx_oauth_codes_expires ON oauth_codes (expires_at);

CREATE TABLE oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  grant_id   TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE INDEX idx_oauth_tokens_grant ON oauth_tokens (grant_id);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens (expires_at);

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
