# webhint-hints

Extra [webhint](https://webhint.io) hints for sites and the APIs next to them. They cover what the stock hints leave out: security headers, Open Graph and SEO, agent readiness, privacy, DNS, TLS, email and the well-known files (`robots.txt`, `security.txt`, `llms.txt`, `ai.txt`).

Every check is ported from a public reference, listed under [References](#references), with the original rules, thresholds and wording kept.

## Install

```bash
npm install --save-dev hint @mridang/webhint-hint-extra
```

## Use

Hints are listed in `.hintrc` as `@mridang/webhint-hint-extra/<id>`:

```json
{
  "connector": { "name": "puppeteer" },
  "formatters": ["stylish"],
  "hints": {
    "@mridang/webhint-hint-extra/csp": "error",
    "@mridang/webhint-hint-extra/hsts": ["error", { "profile": "owasp" }]
  }
}
```

### Groups

A hint can belong to several groups, so a whole source or a whole topic can be switched on at once. Each group is a ready-made preset in `configs/<group>.json`:

```json
{
  "extends": [
    "./node_modules/@mridang/webhint-hint-extra/configs/owasp.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/tls.json"
  ]
}
```

| Kind   | Groups                                                                                |
| ------ | ------------------------------------------------------------------------------------- |
| Source | `observatory`, `owasp`, `opengraph`, `agent-ready`, `webbkoll`, `internetnl`, `files` |
| Topic  | `security-headers`, `tls`, `dns`, `privacy`, `seo`, `social`, `email`, `agent`        |

The source groups keep the original grouping of each reference, so a source can be enabled or disabled as a whole.

## Development

Every command runs through devbox:

```bash
devbox run -- npm test
devbox run -- npm run lint
devbox run -- npm run build
```

`AGENTS.md` explains how a hint is written and tested.

## References

Each hint links to the rule it comes from. The sources, with their licences:

| Source                                                                                                                      | Used for                                                                                                      | Licence                             |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [webhint](https://github.com/webhintio/hint)                                                                                | The hint engine, the hint package layout, and the stock hints this package builds on                          | Apache-2.0                          |
| [MDN HTTP Observatory](https://github.com/mdn/mdn-http-observatory)                                                         | CSP, Referrer-Policy, COOP, COEP, CORP, CORS, cookies, redirection, HSTS, X-Frame-Options                     | MPL-2.0                             |
| [OWASP Secure Headers Project validator](https://github.com/OWASP/secure-headers-project/tree/master/subprojects/validator) | The recommended header values and the headers that should not exist                                           | Apache-2.0                          |
| [OpenGraph.to articles](https://www.opengraph.to/articles)                                                                  | Open Graph, image, Twitter Card, SEO and favicon rules (54 articles, each linked from its hint)               | Site content                        |
| [LLMs.txt Validator](https://llmstxtvalidator.dev/examples)                                                                 | `llms.txt`, `llms-full.txt` and `ai.txt` formats and examples                                                 | Site content                        |
| [llms.txt specification](https://llmstxt.org)                                                                               | `llms.txt` format                                                                                             | Open specification                  |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)                                                                          | `robots.txt`                                                                                                  | IETF                                |
| [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                                          | `security.txt`                                                                                                | IETF                                |
| [Content Signals](https://contentsignals.org)                                                                               | `Content-Signal` in `robots.txt`                                                                              | Open specification                  |
| [Is it agent ready](https://isitagentready.com)                                                                             | The 22 agent-readiness checks and the score structure                                                         | Site behaviour                      |
| [Webbkoll](https://codeberg.org/dataskydd.net/webbkoll)                                                                     | Privacy checks: third-party requests, cookies, local storage, geolocation, mixed content, reporting endpoints | MIT                                 |
| [Internet.nl](https://github.com/internetstandards/Internet.nl)                                                             | IPv6, DNSSEC, DANE, RPKI, CAA, TLS, certificate and email checks                                              | Apache-2.0 (code), CC-BY-4.0 (docs) |

Not used: Webbkoll's tracker-name list (`services.json`) is Disconnect's data under CC BY-NC-SA, so hosts are listed without tracker labels.

### Sources considered later

Lighthouse audits, Google Search Central structured-data rules, Spectral and Redocly OpenAPI rules, Zalando's API ruleset, axe rules, sitespeed.io Coach advice, the IANA well-known URI and link-relation registries, and the WHATWG meta-name registry are candidates for the next round.

## Licence

Apache-2.0
