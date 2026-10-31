# plumbline

The website at [plumbline.apps.mrida.ng](https://plumbline.apps.mrida.ng): type a domain and see the outcome of every [webhint-hints](../hints/README.md) check, run in your own browser. Sign in with Google to keep a list of domains, choose which checks run for each, and keep each domain's reports. Built as a Next.js app on Cloudflare Workers (OpenNext), laid out like the sibling apps chowdown and broadsheet.

The package, `@mridang/webhint-web-extra`, is private: it is never published, only deployed.

The checks run in the visitor's browser, not in the Worker, which is how the app fits the Workers Free plan. The page asks the Worker to start a scan (`POST /api/scans`), which checks the address and signs a scan id with `SCAN_SECRET`. A few Web Workers then load the hints package and run the real hint classes one at a time against the page, parsed with webhint's own DOM. A browser may not read another site's headers or body, so every request a check makes goes through the Worker (`POST /api/scans/{id}/fetches`), one outbound request per call. A check that needs a raw connection, a program, a certificate parser or script in the page is listed as skipped; the [CLI](../cli/README.md) and the [Docker image](../docker/README.md) run them. The Worker runs with the `global_fetch_strictly_public` flag, so a scan only reaches the public internet.

The Worker never imports the hints package. `scripts/build-catalogue.mjs` writes the list of checks to `dist/catalogue.ts` from the built hints package before every build, test, type check and lint, and `scripts/build-views.mjs` bundles the MCP views into `dist/views/`.

## Stack

- Next.js 16 (App Router), React 19 and Tailwind 4, on Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- D1 with Drizzle for people, domains, their checks and reports
- devbox pins Node 22
- Jest for unit tests, Cypress for end-to-end tests
- `@mridang/eslint-defaults` for linting

## Google setup

Signing in asks for identity only (`openid email profile`). Scanning and the list of checks need no sign-in; keeping domains and reports does.

In Google Cloud, create an **OAuth client ID** (Web application) and add these **Authorized redirect URIs**:

- `http://localhost:3737/auth/callback` (dev)
- `https://plumbline.apps.mrida.ng/auth/callback` (prod)

Settings, in `packages/web/.env` locally (gitignored) and as Worker secrets in production (see [Deploy](#deploy)):

```sh
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
SESSION_SECRET=     # openssl rand -base64 32; signs the session cookie
SCAN_SECRET=        # openssl rand -base64 32; signs scan ids
```

There is no dev login and no fallback secret: when a sign-in setting is missing, `/auth/login` answers 503 naming what is missing. `APP_URL` is optional (the public origin, when it can't be read from the request), and `MCP_ALLOWED_ORIGINS` (comma-separated exact origins) lets a browser-based MCP client call `/mcp`.

## Connecting an assistant (MCP)

plumbline is an MCP server at `https://plumbline.apps.mrida.ng/mcp`, protected with OAuth 2.1 as the [MCP authorization spec](https://modelcontextprotocol.io/specification/latest/basic/authorization) describes. Add that URL as a connector in ChatGPT, Claude or any MCP client, sign in with Google when asked, and approve the assistant on `/connect`. There is no secret to copy.

plumbline is listed for the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.mridang/plumbline`; the listing is [`server.json`](server.json).

- **Scopes:** `checks:read` (list checks, domains and reports) and `checks:write` (add and remove domains, choose their checks).
- **Tools:** `list_checks`, `list_domains`, `get_domain`, `list_reports`, `get_report` (drawn as an MCP Apps view), `add_domain`, `remove_domain`, `configure_checks` and `scan_domain`. The checks never run on the server, so `scan_domain` says how to run a scan (the plumbline page, or the CLI command) instead of starting one.
- **Discovery:** `/.well-known/oauth-protected-resource/mcp` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414).
- **Client registration:** Client ID Metadata Documents and dynamic registration (`/oauth/register`, RFC 7591). Public clients only, PKCE `S256` required.
- **Disconnect:** the connected apps in the account, or `POST /oauth/revoke`.

## REST API

The app's data is a REST API under `/api`, designed to the [Zalando RESTful API guidelines](https://opensource.zalando.com/restful-api-guidelines/) (`snake_case` JSON, RFC 3339 timestamps, RFC 9457 problem details). The full contract is [`openapi/plumbline.yaml`](openapi/plumbline.yaml).

| Resource                                   | Methods                                |
| ------------------------------------------ | -------------------------------------- |
| `/api/scans`                               | create (start a scan)                  |
| `/api/scans/{id}/fetches`                  | create (one fetch of a scan)           |
| `/api/checks`                              | list                                   |
| `/api/domains`, `/api/domains/{id}`        | list, create · read, patch, delete     |
| `/api/domains/{id}/reports[/{report_id}]`  | list, create · read                    |
| `/api/users/self`                          | read, delete                           |
| `/api/users/self/connections[/{grant_id}]` | list · delete                          |
| `/api/sessions`, `/api/sessions/self`      | delete (sign out everywhere, sign out) |

Scanning and the checks are public. Everything else needs the `plumbline_session` cookie, answers `401` without it and `403` for a change sent from another site, and is scoped to the signed-in person. A scan of a kept domain runs the checks chosen for it in the browser, and the browser saves the outcome as a report; nothing is scanned on a schedule.

## Limits

Two layers, cheapest first. A refused request answers `429` with `Retry-After`.

1. Cloudflare Workers Rate Limiting bindings, checked in the Worker before the app runs. The limits are in `wrangler.jsonc`; which request counts against which binding is in `src/lib/core/http/edge-limits.ts` and `extras.ts`. They are per Cloudflare location and eventually consistent: a cost guard, not an accounting system.

   | Binding            | Counts                                                        | Per minute |
   | ------------------ | ------------------------------------------------------------- | ---------- |
   | `RL_SCAN`          | starting a scan (`POST /api/scans`), per address              | 5          |
   | `RL_FETCH`         | a scan's fetches, per address                                 | 600        |
   | `RL_API`           | the rest of `/api`, per person                                | 120        |
   | `RL_SITE`          | pages, per address                                            | 300        |
   | `RL_DISCOVERY`     | `/.well-known/*` and other discovery files                    | 120        |
   | `RL_REPORTS`       | `/csp/reports`                                                | 60         |
   | `RL_COVER`         | `/img`, kept from the siblings (plumbline has no image proxy) | 600        |
   | `RL_AUTH`          | sign-in and OAuth approval flows, per address                 | 30         |
   | `RL_TOKEN`         | `/oauth/token`, per address                                   | 600        |
   | `RL_REGISTER`      | `/oauth/register`, per address                                | 10         |
   | `RL_MCP`           | `/mcp` with a token, per token                                | 300        |
   | `RL_MCP_ANONYMOUS` | `/mcp` without a token, per address                           | 60         |
   | `RL_ADDRESS`       | everything that is not a static file, per address             | 900        |

2. A cooldown in D1: one page (its canonical URL) can be scanned once every five minutes, by anyone (`src/domain/scan/cooldown.ts`). The edge limits stop one visitor from starting many scans; this stops many visitors from hammering one site.

## Local development

All commands go through devbox, from the repository root. The catalogue is built from the hints package, so build the workspaces first:

```sh
devbox run -- npm run build                                  # every workspace's dist/, the hints included
devbox run -- npm run migrate --workspace packages/web       # apply D1 migrations to the local database
devbox run -- npm run build:views --workspace packages/web   # the catalogue and the MCP views
devbox run -- npm run dev --workspace packages/web           # next dev on http://localhost:3737
devbox run -- npm test --workspace packages/web              # jest
devbox run -- npm run lint --workspace packages/web          # eslint
devbox run -- npm run typecheck --workspace packages/web     # tsc --noEmit
devbox run -- npm run cypress:run --workspace packages/web   # end-to-end tests
```

Put the settings listed under [Google setup](#google-setup) in `packages/web/.env` before signing in. Scanning works without the Google settings, but needs `SCAN_SECRET`.

## Deploy

```sh
# one-time per environment
devbox run -- npm exec --workspace packages/web -- wrangler d1 create plumbline-db   # paste the id into wrangler.jsonc
devbox run -- npm exec --workspace packages/web -- wrangler secret put GOOGLE_OAUTH_CLIENT_ID
devbox run -- npm exec --workspace packages/web -- wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
devbox run -- npm exec --workspace packages/web -- wrangler secret put SESSION_SECRET
devbox run -- npm exec --workspace packages/web -- wrangler secret put SCAN_SECRET

# every release
devbox run -- npm run build
devbox run -- npm run deploy --workspace packages/web   # D1 migrations, opennextjs-cloudflare build, wrangler deploy
```

The custom domain `plumbline.apps.mrida.ng` requires the `apps.mrida.ng` zone on the Cloudflare account. Register `https://plumbline.apps.mrida.ng/auth/callback` as the Google OAuth redirect URI.

GitHub Actions (`deploy.yml`) builds the workspaces and deploys on pushes to `master`. It needs a `CLOUDFLARE_API_TOKEN` secret and a `CLOUDFLARE_ACCOUNT_ID` variable in the `production` environment.

## Licence

Apache-2.0
