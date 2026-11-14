-- The retention sweep in src/domain/db/oauth.ts read three paths without an
-- index, so each one swept a whole table:
--
--   oauth_grants, twice by the same path: the grants revoked long enough ago to
--     delete, and the live grants nobody has used for half a year, found with
--     `revoked_at IS NULL AND coalesce(last_used_at, created_at) < ?`.
--   oauth_clients, by `kind` and age: the registered clients nobody approved,
--     by created_at, and the metadata documents not fetched for a while, by
--     fetched_at.
--
-- These are the indexes the other apps carry, under the same names.
CREATE INDEX idx_oauth_grants_revoked_used ON oauth_grants (revoked_at, coalesce(last_used_at, created_at));

CREATE INDEX idx_oauth_clients_kind_created ON oauth_clients (kind, created_at);

CREATE INDEX idx_oauth_clients_kind_fetched ON oauth_clients (kind, fetched_at);
