# Plumbline

The website at [plumbline.apps.mrida.ng](https://plumbline.apps.mrida.ng): type a domain and see the outcome of every [plumbline](../hints/README.md) check, run in your own browser. Sign in with Google to keep a list of domains, choose which checks run for each, and keep each domain's reports. Built as a Next.js app on Cloudflare Workers (OpenNext), laid out like the sibling apps chowdown and broadsheet.

The package, `@mridang/plumbline-web`, is private: it is never published, only deployed.

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

## GitHub app

The `/github` page finds the repositories of a person that are deployed web applications and adds the sites they serve to their domains, so their checks can be run. It is off until the GitHub App's settings are set, and nothing else on the site depends on it.

How the accounts are tied together: a person signs in with Google, then connects GitHub from the `/github` page. GitHub's OAuth flow proves who the GitHub user is, and the app links that GitHub user id to the Google account that is signed in (one GitHub account to one person, and an installation to the person who linked it). The GitHub sign-in token is used for three reads (who they are, and which installations of the app they can reach) and is then dropped; only the ids and names are kept. The app reads repositories as itself, with short-lived installation tokens.

A repository counts as a deployed web application when a Wrangler configuration (`wrangler.jsonc`, `wrangler.json` or `wrangler.toml`, at the root or in a subfolder) names the domains it is served on in its top-level `routes` or `route` (custom domains and route patterns; wildcard routes and `workers.dev` addresses are skipped), or when the repository's website field names the live site. Each host found becomes a domain of the owner, tagged with its repository, up to the limit of fifty domains. A repository that uses another host, such as Vercel or Netlify, is not recognised yet.

The checks themselves run in the person's browser, as everywhere else in the app, so they are started from the domain's page and not on a schedule. The exception is a deployment: when GitHub reports a successful deployment (a `deployment_status` event), the Worker runs the page checks that fit in a Worker: the content, mobile and speed checks of the Roctify set (sixteen checks, see `src/domain/suite/`). It makes one request per site and reads the page in one pass with Cloudflare's `HTMLRewriter`, which keeps it inside the Free plan's 10 ms of CPU per request (waiting for the site does not count). A delivery that GitHub sends again is recognised by its id and handled once. The checks that need a real DOM, a socket or DNS (TLS, DNS, mail, most of the structure checks) still run only in the browser: Workers' `connect()` cannot read a certificate or the TLS version.

What a deployment starts depends on what was deployed. A deployment is a preview when GitHub marks it short-lived (`transient_environment`) or its environment is named like one (Preview, Staging, a review app, a pull request); anything else is the live site.

- **The live site.** The Worker checks each site found in that repository (up to five) and stores the run (`suite_runs`, the latest twenty per site), compared with the previous one so what the deployment broke or fixed is known. The sites are checked together, and the same commit reported again within a minute is skipped. A page whose status, body and rules are the same as at the previous run is not read again, but its issue is still brought up to date, so an issue that failed to update, or that a person deleted, is put right by the next deployment. The findings go to one issue per site in the repository, titled `Plumbline: 2 problems on example.com` and labelled `plumbline`. It is edited as the problems change. When they are gone the app comments with the pull request (and commit) that fixed them, found through the deployed commit, and closes it. When they come back it comments and reopens the same issue. An issue a person closes with the problems still there stays closed until the problems change, and one they delete is replaced by a new issue. Only errors open an issue unless `issues: warning` says otherwise, and `issues: off` stops the app from opening or touching issues. Two deliveries cannot open two issues for one site, and a message that only changes in its numbers ("took 1234 ms") counts as the same problem, so an issue a person closed is not reopened because a page got a little slower.
- **A preview.** The Worker checks the address the deployment names (`environment_url`), nothing else, and reports a check run called Plumbline on the deployed commit, which GitHub shows on the pull request: failed when there are errors, neutral for warnings, passed otherwise. Nothing is stored and no issue is opened. A preview that cannot be reached (a login in front of it, for one) gets a neutral check run that says so.

A cron trigger (every 30 minutes) would re-check the sites found through GitHub that have not been checked for a day, three at a time, the longest-waiting first, so a site is still looked at when nothing is deployed. It uses the recommended rules (it does not read `plumbline.yaml`) and opens no issues. The trigger is not set in `wrangler.jsonc`: the Workers Free plan allows five cron triggers per account and this account has used them (the comment there says how to add it back).

### Choosing the rules with plumbline.yaml

A repository needs no configuration: its sites get the `plumbline:recommended` rules on the live site and on previews. To change that, put a `plumbline.yaml` (or `plumbline.yml`, or `plumbline.json`) in the root of the repository. It is read the way ESLint reads its configuration, at the deployed commit, so a pull request that changes it changes the rules of its own preview.

```yaml
extends: plumbline:recommended # a rule set, or a list of them; later ones win
rules:
  seo-viewport: error # off, warn, error or on (0, 1 and 2 work too)
  technical-lazy-loading: off
environments: # changes for one kind of deployment
  preview:
    extends: plumbline:advanced
    rules:
      seo-http-status: warn
issues: error # which findings open an issue: error, warning or off
```

A level says how a rule reports. `off` turns it off, `warn` and `error` report everything it finds as a warning or an error, and `on` keeps each finding's own severity, which is what the rule sets use. A rule that is in no rule set is off until the file turns it on. The environments are `production` (the live site) and `preview`; an environment's settings are applied on top of the file's.

The rule sets are `plumbline:recommended`, the rules whose findings are worth acting on (`seo-http-status`, `seo-viewport`, `seo-links`, `seo-deprecated-html`, `seo-responsive-images`, `icons-apple-touch-icon-missing`, `technical-html-size` and `technical-response-time`), and `plumbline:advanced`, which adds the advisory content and performance rules (`seo-content-length`, `seo-keywords-frequent`, `seo-keywords-in-title`, `seo-link-anchor-text`, `seo-url-friendly`, `technical-asset-count`, `technical-image-formats` and `technical-lazy-loading`).

Any check of the catalogue can be named as a rule, so a file can turn on DNS or mail rules for previews (`environments.preview.rules`). Those checks cannot run in a Worker yet, so the check run lists them as only running in the browser scan rather than silently skipping them. The file is read as far as 32 KB, and a page as far as 3 MB (a bigger page is checked as far as it was read and counted as over the size limit); a page must also stay on https through its redirects. A mistake in the file (a rule that does not exist, a level that is not one, a key it does not know, text that is not YAML) never fails a run: what can be read is used, and each mistake is listed, made safe to show (no mentions or links) and cut to the first twenty, in the summary of the check run or the issue.

When `plumbline.yaml` changes on the default branch the live site is checked again under the new rules, even a moment after the last check.

Create a GitHub App (Settings, Developer settings, GitHub Apps) with:

- **Callback URLs** (GitHub apps take several), each on `https://plumbline.apps.mrida.ng` in production and `http://localhost:3737` for development: `/auth/github/link/callback` (linking a GitHub account to a Google sign-in) and `/auth/github/callback` (signing in with GitHub). The earlier `/api/github/callback` still answers, with a redirect to the first, until the settings are changed; then delete `src/app/api/github/callback/route.ts`.
- **Request user authorization (OAuth) during installation:** ticked. GitHub then disables the Setup URL and Redirect on update and sends people back to the callback URL, which is what the app wants (it needs the sign-in `code` only that flow supplies). Leave Enable Device Flow off.
- **Webhook URL:** `https://plumbline.apps.mrida.ng/webhooks/github`, with a webhook secret. The earlier `/api/github/webhook` still answers with the same handler until the setting is changed; then delete `src/app/api/github/webhook/route.ts`.
- **Permissions:** Repository permissions: Contents (read-only for the repository's files and `plumbline.yaml`; read and write only if you want `repository_dispatch` events, see below), Deployments (read-only), Issues (read and write, for the issue that tracks a site), Checks (read and write, for the check run on a preview), and Pull requests (read-only, to name the pull request that fixed a problem). Metadata is read-only by default.
- **Subscribe to events:** Push (a push to a Wrangler file reads the installation again, and a push of `plumbline.yaml` to the default branch checks the live site again), Deployment status (a successful deployment runs the checks) and Issues (an issue a person closes, reopens or deletes is noted). The installation events are always sent: an installation that is removed is forgotten, and one that is created, gets new permissions accepted or is unsuspended is read again, as is one whose repositories change.

### Hooking into the results

A repository that sets `dispatch: true` in `plumbline.yaml` gets a `repository_dispatch` event after each run of its live site or a preview: `plumbline.checked` every time, and `plumbline.failed` as well when there are errors. A workflow listens for them:

```yaml
on:
  repository_dispatch:
    types: [plumbline.failed]
jobs:
  react:
    runs-on: ubuntu-latest
    steps:
      - run: echo "${{ github.event.client_payload.host }} has ${{ github.event.client_payload.errors }} errors"
```

The payload has `version`, `environment`, `url`, `host`, `sha`, `conclusion`, `errors`, `warnings`, `hints` and the first ten `findings` (`id`, `severity`, `message`). GitHub only accepts the event when the app has Contents set to read and write; without it the event is not sent and the failure is logged, and the issue and check run are unaffected.

### Who sees what

A person can sign in with Google (`/auth/login`) or with GitHub (`/auth/github`), including an owner of an organization that installed the app and anyone with access to one of its repositories. When they sign in, GitHub is asked, with the app's own sign-in, which repositories of the installed app they can reach (`/user/installations/{id}/repositories`), and those are kept per person (`user_repositories`). The dashboard shows the sites they added themselves and every site of those repositories, so a member sees the stats of the repositories they have access to and nothing else; live updates and notifications of a site go to everyone who can see its repository. What GitHub said is honoured for twelve hours: a person who loses access on GitHub stops seeing a repository within that time, or at their next sign-in, whichever comes first. Only the person who connected an installation can change it; the rest see the dashboard.

### Reports are made by commit, not by time

A site's checks run when a commit is deployed (and a preview's when its deployment succeeds); what they find is shown live and kept by commit. A commit that has been checked is not checked again, however long ago, unless the rules in `plumbline.yaml` changed. Nothing is reused because a clock says it is recent: the badge is checked with the server every time (it answers 304 when the score has not changed), a preview report is kept under its id and never changes, and a site is asked whether its page changed with its own `ETag` or `Last-Modified`, never left alone because of its `max-age`. The only thing that runs on a timer is the daily re-check of sites found through GitHub, which catches a site that changed without a commit.

Changing the permissions of an installed app asks each owner to accept them, and until they do the app keeps the old ones. Without the Issues or Checks permission a deployment is still checked and stored, and the failure to report it is logged.

Then set, in `packages/web/.env` locally and as Worker secrets in production:

```sh
GITHUB_APP_ID=
GITHUB_APP_SLUG=          # the app's name in github.com/apps/<slug>
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=       # the downloaded .pem; newlines may be written \n or &
GITHUB_WEBHOOK_SECRET=
```

GitHub cannot reach `localhost`, so to try webhooks locally forward them with a tunnel; the connect and install flow itself works against `http://localhost:3737`.

## The live dashboard and notifications

`/dashboard` shows every repository and site of the signed-in person and how each stands, and updates as checks run, with no refreshing. A per-person Durable Object (`UserHub`, `src/lib/cloudflare/user-hub.ts`) holds the open server-sent-event streams and replays what a reconnecting browser missed from the `live_events` table; the same pattern as marshall's `RepoHub`. A check tells the dashboard when it begins and ends (`src/domain/live/live.ts`).

Notifications use Web Push with VAPID, as in marshall. The public key and subject are `vars` in `wrangler.jsonc`; the private key is a secret, `VAPID_PRIVATE_KEY` in `packages/web/.env` locally and `wrangler secret put VAPID_PRIVATE_KEY` in production. Without it notifications are simply off. A person is told when a site starts to fail, is fixed, stops answering, or has a different number of problems after a check (`src/domain/live/changes.ts`), and turns them on per device on the dashboard.

## Moving to the Workers Paid plan

Every number that depends on the Cloudflare plan is in `src/domain/suite/limits.ts`: how many sites one deployment checks, how many a cron trigger re-checks, and how many are checked at the same time. The Free plan's values are the default. This account is on Paid: `WORKERS_PLAN` is `paid` in the `vars` of `wrangler.jsonc` and the cron trigger fires every ten minutes. To go back to Free, set it to `free` and use `*/30 * * * *` (the Free plan allows five cron triggers per account).

## Connecting an assistant (MCP)

Plumbline is an MCP server at `https://plumbline.apps.mrida.ng/mcp`, protected with OAuth 2.1 as the [MCP authorization spec](https://modelcontextprotocol.io/specification/latest/basic/authorization) describes. Add that URL as a connector in ChatGPT, Claude or any MCP client, sign in with Google when asked, and approve the assistant on `/connect`. There is no secret to copy.

Plumbline is listed for the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.mridang/plumbline`; the listing is [`server.json`](server.json).

- **Scopes:** `checks:read` (list checks, domains and reports) and `checks:write` (add and remove domains, choose their checks).
- **Tools:** `list_checks`, `list_domains`, `get_domain`, `list_reports`, `get_report` (drawn as an MCP Apps view), `add_domain`, `remove_domain`, `configure_checks` and `scan_domain`. The checks never run on the server, so `scan_domain` says how to run a scan (the Plumbline page, or the CLI command) instead of starting one.
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
   | `RL_COVER`         | `/img`, kept from the siblings (Plumbline has no image proxy) | 600        |
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
