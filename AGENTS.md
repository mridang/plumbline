# Agent instructions

This package adds extra hints to [webhint](https://webhint.io). Every hint is a small class built with `defineHint`, listed in the registry, and tested against a real webhint scan.

## HTTP header coverage (standing rule)

This package aims to check **every HTTP response header documented by MDN that is not deprecated**. The canonical list is the [MDN HTTP headers reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers). Whenever this project is next worked on, reconcile our `headers` set against that page: for every non-deprecated **response** header (request-only headers such as `Accept`, `Sec-Fetch-*` or `User-Agent` are out of scope — a scanner only sees responses), there must be a hint that checks its presence and/or validity and/or best-practice value. A deprecated header (for example `X-XSS-Protection`, `Expect-CT`, `Public-Key-Pins`, `Feature-Policy`, `Pragma`, `Warning`, `Tk`) is checked the other way: a hint that reports when it _is_ present. Headers that only appear on specific responses (`WWW-Authenticate`, `Content-Range`, `Allow`, `Accept-Ranges`) are checked for validity when present and are otherwise not applicable. When MDN adds a header, add a hint for it; do not wait to be asked.

## Commands

Run every command through devbox, inside this directory.

- `devbox run -- npm test -- --coverage=false <path>` runs tests.
- `devbox run -- npx tsc --noEmit -p tsconfig.jest.json` type checks source and tests.
- `devbox run -- npx eslint <paths>` lints. Never suppress a warning inline and never turn a rule off.
- `devbox run -- npx prettier --write <paths>` formats.
- `devbox run -- npm run build` compiles to `dist/`.

Do not run `npm install` unless you have been told to. Use Node built-ins and the `@hint/*` packages that are already installed. Do not add a dependency that needs a native binary.

## Layout

This repository is an npm-workspaces monorepo. The hints package lives in `packages/hints/`, with the companion `@mridang/webhint-formatter-plumbline` in `packages/formatter/`, `@mridang/lighthouse-plugin-plumbline` in `packages/lighthouse/`, the Docker scan server `@mridang/plumbline-docker` in `packages/docker/` (a private, unpublished package shipped only as the `mridang/plumbline` image), the CLI `@mridang/plumbline` in `packages/cli/` (the `plumbline` executable, built on oclif: one command class per command in `src/commands/`, listed in `src/commands.ts`, with the work in `src/run.ts`; it also owns the scan and report logic the Docker server imports), the agent skills and Claude Code plugin `@mridang/plumbline-skills` in `packages/skills/` (listed in the repository's `.claude-plugin/marketplace.json`), and the web app `@mridang/plumbline-web` in `packages/web/` (plumbline, a private Next.js app deployed to Cloudflare Workers; see below). The paths below are relative to `packages/hints/`. Commands run from the repository root through devbox and operate over every workspace.

- `src/core/` shared helpers: `defineHint`, `groups`, `http` (header helpers), `page` (`onPage`, `onSite`). Do not edit these; add your own helper file instead.
- `src/lib/` pure logic with no webhint types (parsers, validators, scoring). Put anything non-trivial here so it can be tested without a scan.
- `src/hints/<set>/<id>.ts` one hint per file, default export of `defineHint(...)`.
- `src/hints/<set>/index.ts` lists the set's hints in an exported array. This is the only registration needed.
- `test/` mirrors `src/`: `src/lib/x.ts` is tested by `test/lib/x.test.ts`, and `src/hints/<set>/<id>.ts` by `test/hints/<set>/<id>.test.ts`. Never create a test file named after a feature, a bug or a review. Never create a catch-all test file.

## Writing a hint

A hint has an `id` (kebab-case, unique), a `name`, a one-sentence `description`, a `category`, the `groups` it belongs to, an optional `reference` link, and a `setup(context)` that subscribes to webhint events. Use `onPage` for work on the scanned page (its headers and DOM) and `onSite` for work that fetches other URLs, resolves DNS or opens connections after the scan.

`groups` lists the original source (`observatory`, `owasp`, `opengraph`, `agent-ready`, `webbkoll`, `internetnl`, `files`) and every topic that applies (`security-headers`, `tls`, `dns`, `privacy`, `seo`, `social`, `email`, `agent`). A hint may be in several groups. Keep the original source group even when a check came from more than one source: list each.

Messages state the problem plainly. Report with `severity` `Severity.error` for a failed rule, `Severity.warning` for advice and `Severity.hint` for information. Where a source defines levels, keep them.

Comment generously: a doc comment on every hint saying what is checked, where the rule comes from and why, and inline comments for non-obvious logic.

## What a finding carries

Webhint's report shows more than the message, so fill in what applies. `defineHint` already adds the hint's reference as "Further reading" to every finding; do not add it again.

- **Markup at fault:** pass `element` (the DOM element) in the report options. Webhint then works out the line and column and the code snippet itself. For something that is missing, pass the element it belongs in (for example `<head>`) and a `codeSnippet` with `codeLanguage: 'html'` showing the tag to add.
- **Header at fault:** pass `codeLanguage: 'http'` and a `codeSnippet` of the offending header line (`Name: value`), or of the header to add when it is missing.
- **File at fault:** pass the offending line as `codeSnippet` and its position as `location` (`{ line, column }`).
- **Everything else** (DNS records, certificates, ciphers, requests): pass a `codeSnippet` of the evidence, such as the record or the list of offending items.
- **Resource:** report against the URL that was inspected, not always the page.
- Keep messages, severities and thresholds as they are; this is detail only. Tests assert the extra fields (`sourceCode`, `location`) on the returned problems.

## Tests

- Unit-test pure logic in `src/lib` directly, with every failure path and edge case.
- Test each hint with `runHint(hint, routes)` from `test/helpers/run-hint.ts`. It starts a local server, runs one real scan with only that hint switched on and returns the problems. Cover the passing case, each failing case and each warning.
- Tests never touch the internet. Hints that resolve DNS, query DNS-over-HTTPS, open TLS connections or call third-party APIs take their client as an injectable dependency with a real default, and tests pass a fake or point at a local server.
- Every rule has a test that fails without it.

## Web app

`packages/web/` is plumbline, a Next.js app on Cloudflare Workers laid out like the sibling apps (chowdown, broadsheet): their shared shell (`src/lib/core/`, `src/components/`, `src/app/` metadata, error and crawler files, the config files) is copied byte-identical, and the per-app values are in `src/app/_brand.ts`, `src/utils/site.ts`, `src/lib/core/http/site.ts` and `extras.ts`. It has its own `eslint.config.mjs`, `jest.config.mjs` and `tsconfig.json`, as the siblings do; the root `lint` and `test` scripts run them after their own. Every package it uses is a devDependency, because OpenNext bundles them into the Worker and the Docker image must not carry them.

Every check runs on the server, in the scanner container (see the Scanner section). The page asks the Worker to start a scan (`POST /api/scans`, `src/domain/api/scans.ts`), which checks the address and signs a scan id, then asks it to run (`POST /api/scans/{id}/run`); the Worker forwards that to the container and streams its JSON lines back (`src/domain/scan/run.ts`, read by `stream.ts` and `session.ts`), so the results appear as each check finishes. The hints package is a Node package: it imports Node's socket, TLS, process, crypto and file modules through the `#` names in its `package.json` (`#net`, `#tls`, …), which resolve to `src/node/`.

Sign-in with Google, the session cookie and the users table follow broadsheet (`src/lib/core/auth/`, `src/lib/session/`, `src/lib/web-security/`, `src/lib/google/`, `src/domain/auth/`); the OAuth server, the MCP engine and the MCP Apps view plumbing follow chowdown (`src/lib/oauth/`, `src/lib/mcp/`, `src/app/oauth/`, `src/domain/mcp/{auth,env,http,request-limits}.ts`, `src/views/`). Those shared files are byte-identical to the sibling they follow; what is plumbline's own in them lives in per-app modules: the scopes, their wording, read-only tools and argument aliases in `src/domain/mcp/app.ts`, what a person must have before approving a connection in `src/app/oauth/authorize/app-gate.tsx`, what else to tidy up when an account is deleted in `src/domain/account/app.ts`, and the views' colours, CSS and request arguments in `src/views/app.ts` (data guards in `src/views/guards.ts`). Never put an app value back into a shared file. plumbline's own parts are the D1 tables (`migrations/`, `src/domain/db/`), the REST resources (`src/domain/api/domains.ts`, `reports.ts`, `checks.ts`, `github.ts`; the contract is `packages/web/openapi.json` (one file at the root of the app, only `/api`, kept honest by `test/openapi.test.ts`) and follows the `api-design` skill: what is not REST sits outside `/api`, namely the sign-in and link flows `/auth/*`, the live stream `/events`, the GitHub webhook `/webhooks/github`, the badge `/badge/*` and the report pages `/r/{id}`), the MCP tools (`src/domain/mcp/tool-*.ts`) and the views (`src/views/report*.tsx`, `domain-list*.tsx`). The GitHub App (off until its settings are set; see `packages/web/README.md`) is plumbline's own too: `src/domain/github/` (the API client, app JWT and installation tokens, the OAuth link between the Google and GitHub accounts, Wrangler deployment detection, and the sync that adds the hosts found as domains), `src/domain/db/github.ts`, the `/api/github/*` routes and the `/github` page. A scan's fix prompt for a coding assistant is built in `src/components/scan/fix-prompt.ts`. The Worker does not import the hints package (it is far over the Worker's size limit); every check runs in the scanner container (`packages/docker`, `packages/cli/src/engine/`), which the Worker reaches through the `ScannerContainer` Durable Object (`src/lib/cloudflare/scanner-container.ts`). `src/domain/suite/` runs the checks a successful GitHub deployment starts (`deployment_status` webhook; `github-run.ts` reads the repository's `plumbline.yaml` through `config.ts`, `rules.ts` holds the rule sets and levels, `publish.ts` opens, updates, closes and reopens the issue of a live site and creates the check run of a preview, `issue-events.ts` follows what people do to those issues, and `report.ts` writes their text). A scan takes longer than a webhook delivery may keep working, so the webhook only leaves a job (`scanner.ts`: `enqueueJob`) with the Durable Object, which keeps it in its storage and runs it from an alarm; `scanner.ts` also reads the scanner's NDJSON stream (`collectScan`), `checks.ts` turns the outcomes into results named by check id, `run.ts` makes a `SuiteRun` of a scan (and refuses one where no check ran), `deploy.ts` finds the repository's sites, stores each run (`src/domain/db/suite.ts`, migration `0003_suite.sql`) and diffs it with the last one (a check the scanner could not run keeps its previous findings), and `scheduled.ts` is the cron trigger that re-checks the sites not checked for a day by scanning them through the same Durable Object, registered in `src/lib/core/worker-extras.ts`. The catalogue: `scripts/build-catalogue.mjs` writes the list of checks to `dist/catalogue.ts` before every build, test, type check and lint, and `scripts/build-views.mjs` bundles the views into `dist/views/`.

## Scanner

The scanner is the `scanner` stage of the root `Dockerfile` (Node, `openssl`, no browser; it must stay the last stage, because wrangler builds the last stage), run as a Cloudflare container behind the `ScannerContainer` Durable Object (`src/lib/cloudflare/scanner-container.ts`, binding `SCANNER`), which starts it on demand and lets it stop when idle. It serves `POST /run {url}` (`packages/docker/src/server.ts`), which streams one JSON line per event: `ready` with the list of checks, a `done` outcome per check as it finishes, then `end`, or `unreachable` when the page cannot be fetched. The work is `runScan` in `packages/cli/src/engine/`: the real hint classes, driven by a stand-in for webhint's engine (`engine.ts`), with every fetch, DNS lookup and socket going through a guard that refuses non-public addresses (`guard.ts`), so a scan of a user-supplied address cannot reach the container's own network. The checks that need script run in a real page (`BROWSER_ONLY`) are shown as skipped. The page's outcome types are in `src/domain/scan/outcome.ts`.

## Dependency overrides

The root `package.json` overrides a few dependencies of webhint's packages (`@hint/connector-puppeteer`, `cacache`, `@mapbox/node-pre-gyp`, `update-notifier`, and three hint and utility packages) to versions that fix published advisories. Each is scoped to the webhint package that asks for the old version, so it stops applying when webhint moves on, and each uses a caret range so patch releases still flow. Delete an entry once webhint's own release asks for a fixed version.

The overrides only apply to this repository's install and the Docker image, not to people who install the published packages from npm. Most of them touch code the CLI never runs (the update checker, the npm registry cache, the optional presets), and forcing a new major version there can break that code if a path is ever enabled. The Puppeteer override is the exception: the CLI runs it, and `scan.ts` carries a small shim for the one method the connector calls that Puppeteer 25 renamed. Do not set the connector's `detached` or `ignoreHTTPSErrors` options without checking them against Puppeteer 25.

## Commits

Conventional Commits, short body under 100 columns, no trailers and no attribution of any kind. The lead commits; agents do not.

## References

Every source is listed in `README.md`. Keep a rule's wording and thresholds faithful to its source, and link the source in the hint's `reference`.
