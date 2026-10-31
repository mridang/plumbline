# webhint-hints

About 270 checks for a website and the services around it: security headers, TLS and certificates, DNS, email authentication, Open Graph and SEO, privacy, agent readiness, and the well-known files (`robots.txt`, `security.txt`, `llms.txt`, `ai.txt`). Every check is ported from a public reference, such as Mozilla Observatory, OWASP, Webbkoll, internet.nl, MDN and isitagentready, with its original rules, thresholds and wording kept (see [References](#references)).

The checks are [webhint](https://webhint.io) hints, and everything else in this repository is a way to run them.

| Package                                                            | What                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`@mridang/webhint-hint-extra`](packages/hints/README.md)          | The hints, the group presets and the full list of checks         |
| [`@mridang/webhint-formatter-extra`](packages/formatter/README.md) | An HTML report for webhint, sectioned and filterable             |
| [`lighthouse-plugin-webhint-extra`](packages/lighthouse/README.md) | A Lighthouse plugin with the checks Lighthouse can run           |
| [`@mridang/plumbline`](packages/cli/README.md)                     | The `plumbline` CLI, which runs every check                      |
| [`@mridang/plumbline-skills`](packages/skills/README.md)           | The agent skill and the Claude Code plugin that run the CLI      |
| [`@mridang/webhint-docker-extra`](packages/docker/README.md)       | A scan server, shipped only as the `mridang/webhint-hints` image |
| [`@mridang/webhint-web-extra`](packages/web/README.md)             | The plumbline website, on Cloudflare Workers (private)           |

## How to use it

The npm packages and the Docker image are released together; until the first release, [build the packages from this repository](packages/hints/README.md#before-the-first-release) or [build the image](packages/docker/README.md#build-the-image).

### On the website

Go to [plumbline.apps.mrida.ng](https://plumbline.apps.mrida.ng) and type a domain. The checks run in your browser, through the site's Worker, so nothing needs installing. Sign in with Google to keep a list of domains, choose which checks run for each, and keep their reports. A browser cannot open raw connections, so the TLS, mail and socket checks show as skipped there; the CLI runs them. See [`packages/web`](packages/web/README.md).

### From the command line

```sh
npx @mridang/plumbline scan example.com
npx @mridang/plumbline scan example.com --group tls,email --fail-on warning
npx @mridang/plumbline checks --group owasp
```

It runs every check from Node with a real Chrome, exits 1 when a finding is at or above `--fail-on` so it can gate a CI job, and prints text, JSON or the HTML report. A Chrome-family browser must be installed. See [`packages/cli`](packages/cli/README.md).

### With a coding agent

The [skills package](packages/skills/README.md) teaches an agent (Claude Code, Codex, Cursor, GitHub Copilot and others that read the Agent Skills format) to audit a site with the CLI, read the findings and explain the fixes. Install the skill with:

```sh
npx skills add mridang/webhint-hints
```

In Claude Code it is also a plugin, with an `/plumbline:audit <url>` command that runs the scan for you:

```text
/plugin marketplace add mridang/webhint-hints
/plugin install plumbline@plumbline
```

The skill runs `npx @mridang/plumbline`, so the agent needs Node 22 and a Chrome-family browser. See [`packages/skills`](packages/skills/README.md) for copying the skill by hand.

### From an assistant (MCP)

Add `https://plumbline.apps.mrida.ng/mcp` as a connector in ChatGPT, Claude or any MCP client, sign in with Google when asked, and approve. The assistant can then list the checks, keep your domains, choose their checks and read their reports. See [Connecting an assistant](packages/web/README.md#connecting-an-assistant-mcp).

### In webhint

```sh
npm install --save-dev hint @hint/connector-puppeteer @hint/parser-html @mridang/webhint-hint-extra
```

Extend the group presets you want in `.hintrc`, or list single hints as `@mridang/webhint-hint-extra/<id>`:

```json
{
  "formatters": ["stylish"],
  "extends": [
    "./node_modules/@mridang/webhint-hint-extra/configs/observatory.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/email.json"
  ],
  "hints": {
    "@mridang/webhint-hint-extra/hsts": ["default", { "profile": "owasp" }]
  }
}
```

```sh
npx hint https://example.com/
```

The groups, the sections, the hint options and the table of every hint are in [`packages/hints`](packages/hints/README.md).

### The report formatter

```sh
npm install --save-dev @mridang/webhint-formatter-extra
```

```json
{
  "formatters": ["@mridang/webhint-formatter-extra"]
}
```

webhint then writes `hint-report/<site>.html`, one self-contained page with the findings grouped by section, each hint's description and sources, and a filter by source. See [`packages/formatter`](packages/formatter/README.md).

### In Lighthouse

```sh
npm install --save-dev lighthouse lighthouse-plugin-webhint-extra
npx lighthouse https://example.com/ --plugins=lighthouse-plugin-webhint-extra
```

The plugin adds a "Webhint extra" category with the 143 checks whose data Lighthouse already gathers (headers, Open Graph, SEO, structured data, privacy). See [`packages/lighthouse`](packages/lighthouse/README.md).

### With Docker

```sh
docker run --rm -p 8080:8080 mridang/webhint-hints
curl -s localhost:8080/scan -d '{"url":"https://example.com/"}'
```

A small HTTP server that scans a URL with a real Chromium and answers with the findings as JSON, for end-to-end tests in any language. See [`packages/docker`](packages/docker/README.md).

## Development

This is an npm-workspaces monorepo. Every command runs through devbox, from the repository root, and operates over every workspace:

```sh
devbox run -- npm run build                                  # compile every workspace to dist/
devbox run -- npm test                                       # every test, the web app's included
devbox run -- npx jest --coverage=false packages/cli         # one package's tests
devbox run -- npx tsc --noEmit -p tsconfig.jest.json         # type check sources and tests
devbox run -- npm run lint                                   # eslint
devbox run -- npx prettier --write <paths>                   # format
```

[`AGENTS.md`](AGENTS.md) explains how a hint is written, registered and tested, and the standing rule for HTTP header coverage.

## References

Each hint links to the rule it comes from. The sources, with their licences:

| Source                                                                                                                      | Used for                                                                                                                                    | Licence                             |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [webhint](https://github.com/webhintio/hint)                                                                                | The hint engine, the hint package layout, and the stock hints this package builds on                                                        | Apache-2.0                          |
| [MDN HTTP Observatory](https://github.com/mdn/mdn-http-observatory)                                                         | CSP, Referrer-Policy, COOP, COEP, CORP, CORS, cookies, redirection, HSTS, X-Frame-Options                                                   | MPL-2.0                             |
| [OWASP Secure Headers Project validator](https://github.com/OWASP/secure-headers-project/tree/master/subprojects/validator) | The recommended header values and the headers that should not exist                                                                         | Apache-2.0                          |
| [OpenGraph.to articles](https://www.opengraph.to/articles)                                                                  | Open Graph, image, Twitter Card, SEO and favicon rules (54 articles, each linked from its hint)                                             | Site content                        |
| [LLMs.txt Validator](https://llmstxtvalidator.dev/examples)                                                                 | `llms.txt`, `llms-full.txt` and `ai.txt` formats and examples                                                                               | Site content                        |
| [llms.txt specification](https://llmstxt.org)                                                                               | `llms.txt` format                                                                                                                           | Open specification                  |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)                                                                          | `robots.txt`                                                                                                                                | IETF                                |
| [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                                          | `security.txt`                                                                                                                              | IETF                                |
| [Content Signals](https://contentsignals.org)                                                                               | `Content-Signal` in `robots.txt`                                                                                                            | Open specification                  |
| [Is it agent ready](https://isitagentready.com)                                                                             | The 22 agent-readiness checks and the score structure                                                                                       | Site behaviour                      |
| [Webbkoll](https://codeberg.org/dataskydd.net/webbkoll)                                                                     | Privacy checks: third-party requests, cookies, local storage, geolocation, mixed content, reporting endpoints                               | MIT                                 |
| [MDN HTTP headers reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers)                           | The full set of non-deprecated HTTP response headers (see the standing rule in [AGENTS.md](AGENTS.md))                                      | CC-BY-SA-2.5                        |
| [LLMScout](https://github.com/RudrenduPaul/LLMScout)                                                                        | Technical SEO and generative-engine checks: heading hierarchy, image alt and weight, redirect chain, FAQ, Speakable and Organization schema | MIT                                 |
| [Internet.nl](https://github.com/internetstandards/Internet.nl)                                                             | IPv6, DNSSEC, DANE, RPKI, CAA, TLS, certificate and email checks                                                                            | Apache-2.0 (code), CC-BY-4.0 (docs) |

Not used: Webbkoll's tracker-name list (`services.json`) is Disconnect's data under CC BY-NC-SA, so hosts are listed without tracker labels.

### Sources considered later

Lighthouse audits, Google Search Central structured-data rules, Spectral and Redocly OpenAPI rules, Zalando's API ruleset, axe rules, sitespeed.io Coach advice, the IANA well-known URI and link-relation registries, and the WHATWG meta-name registry are candidates for the next round.

## Licence

Apache-2.0
