# webhint-hints

Extra [webhint](https://webhint.io) hints for sites and the APIs next to them. They cover what the stock hints leave out: security headers, Open Graph and SEO, agent readiness, privacy, DNS, TLS, email and the well-known files (`robots.txt`, `security.txt`, `llms.txt`, `ai.txt`).

152 hints in total. Every check is ported from a public reference, listed under [References](#references), with the original rules, thresholds and wording kept.

## Install

```bash
npm install --save-dev hint @mridang/webhint-hint-extra
```

## Try it

The package is not published yet, so install it from a local build into a scratch folder and scan a site. Nothing is added to the site you scan:

```bash
cd ~/Code/mridang/webhint-hints
devbox run -- npm run build
devbox run -- npm pack --pack-destination "$(mktemp -d)"
```

`npm pack` prints the path of the tarball. Then, in an empty scratch folder:

```bash
npm init -y
npm install hint @hint/connector-puppeteer @hint/parser-html /path/to/mridang-webhint-hint-extra-0.0.0.tgz
```

Create `.hintrc` with the groups you want (a Chrome or Chromium install is needed for the `puppeteer` connector):

```json
{
  "formatters": ["stylish", "html"],
  "extends": [
    "./node_modules/@mridang/webhint-hint-extra/configs/observatory.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/owasp.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/opengraph.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/agent-ready.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/webbkoll.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/internetnl.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/files.json",
    "./node_modules/@mridang/webhint-hint-extra/configs/llmscout.json"
  ]
}
```

Run it. The `html` formatter writes `hint-report/<site>.html`, which you can open in a browser:

```bash
npx hint https://example.com/
```

## Report formatter

The stock `html` report only has webhint's eight categories, never shows a hint's description and links every hint to `webhint.io` pages that do not exist for these hints. The companion package `@mridang/webhint-formatter-extra` (in [`formatter/`](formatter)) writes a better report. Install it next to `hint` and list it in `.hintrc`:

```json
{
  "formatters": ["@mridang/webhint-formatter-extra"]
}
```

It writes one self-contained HTML file, `hint-report/<site>.html`, that works in light and dark mode and on a phone. Hints are sectioned by topic (agent readiness, email, DNS, TLS, privacy, security headers, social previews, SEO) from their `groups`, and stock hints by their webhint category. Each hint shows its description, a reference link, its other groups as badges and its findings with code snippets and further reading. Sections without findings show as passed, and the source buttons (`observatory`, `owasp` and so on) filter the report. When the `agent-score` hint ran, its score is shown as a summary card at the top.

## Use

Hints are listed in `.hintrc` as `@mridang/webhint-hint-extra/<id>`. Use `default` as the severity so each hint keeps the level its rule defines:

```json
{
  "connector": { "name": "puppeteer" },
  "formatters": ["stylish"],
  "hints": {
    "@mridang/webhint-hint-extra/csp": "default",
    "@mridang/webhint-hint-extra/hsts": ["default", { "profile": "owasp" }]
  }
}
```

### Groups

A hint can belong to several groups, so a whole source or a whole topic can be switched on at once. Each group is a ready-made preset in `configs/<group>.json`; extend one or several as shown above.

| Kind   | Groups                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------- |
| Source | `observatory`, `owasp`, `opengraph`, `agent-ready`, `webbkoll`, `internetnl`, `files`, `llmscout` |
| Topic  | `security-headers`, `tls`, `dns`, `privacy`, `seo`, `social`, `email`, `agent`                    |

The source groups keep the original grouping of each reference, so a source can be enabled or disabled as a whole.

### Hints

| Hint                                     | What it checks                                                                                                                 | Groups                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `agent-a2a-agent-card`                   | Requires an A2A agent card at /.well-known/agent-card.json.                                                                    | `agent-ready`, `agent`                                               |
| `agent-acp`                              | Reports whether /.well-known/acp.json is published.                                                                            | `agent-ready`, `agent`                                               |
| `agent-ai-bot-rules`                     | Requires robots.txt rules naming known AI crawlers.                                                                            | `agent-ready`, `privacy`, `agent`                                    |
| `agent-api-catalog`                      | Requires an RFC 9727 linkset at /.well-known/api-catalog.                                                                      | `agent-ready`, `agent`                                               |
| `agent-ard`                              | Requires a valid AI catalog at /.well-known/ard.json.                                                                          | `agent-ready`, `dns`, `agent`                                        |
| `agent-auth-md`                          | Requires /auth.md with agent registration instructions.                                                                        | `agent-ready`, `agent`                                               |
| `agent-content-signals`                  | Requires a Content-Signal directive in robots.txt.                                                                             | `agent-ready`, `privacy`, `agent`                                    |
| `agent-dns-aid`                          | Requires SVCB or HTTPS records under _agents of the host (DNS-AID).                                                            | `agent-ready`, `dns`, `agent`                                        |
| `agent-link-headers`                     | Requires a Link header with an agent-useful relation such as api-catalog or service-desc.                                      | `agent-ready`, `agent`                                               |
| `agent-markdown-negotiation`             | Requires text/markdown when the home page is requested with Accept: text/markdown.                                             | `agent-ready`, `agent`                                               |
| `agent-mcp-server-card`                  | Requires an MCP server card with serverInfo and a transport endpoint.                                                          | `agent-ready`, `agent`                                               |
| `agent-mpp`                              | Reports whether /openapi.json advertises x-payment-info (MPP).                                                                 | `agent-ready`, `agent`                                               |
| `agent-oauth-discovery`                  | Requires OIDC or RFC 8414 authorization server metadata with a valid issuer.                                                   | `agent-ready`, `agent`                                               |
| `agent-oauth-protected-resource`         | Requires /.well-known/oauth-protected-resource with a resource on this site.                                                   | `agent-ready`, `agent`                                               |
| `agent-poppy`                            | Requires a valid /.well-known/poppy.json.                                                                                      | `agent-ready`, `agent`                                               |
| `agent-robots-txt`                       | Requires a text/plain /robots.txt with at least one User-agent directive.                                                      | `agent-ready`, `agent`                                               |
| `agent-score`                            | Reports the overall agent readiness score and level.                                                                           | `agent-ready`, `agent`                                               |
| `agent-sitemap`                          | Requires a valid XML sitemap listed in robots.txt or at /sitemap.xml.                                                          | `agent-ready`, `agent`                                               |
| `agent-skills`                           | Requires an agent skills index with name, type, description, url and digest per skill.                                         | `agent-ready`, `agent`                                               |
| `agent-ucp`                              | Reports whether /.well-known/ucp is published.                                                                                 | `agent-ready`, `agent`                                               |
| `agent-web-bot-auth`                     | Requires a key directory at /.well-known/http-message-signatures-directory.                                                    | `agent-ready`, `security-headers`, `agent`                           |
| `agent-webmcp`                           | Requires the page to expose WebMCP tools (modelContext or toolname forms).                                                     | `agent-ready`, `agent`                                               |
| `agent-x402`                             | Reports whether an endpoint answers 402 Payment Required (x402).                                                               | `agent-ready`, `agent`                                               |
| `ai-txt`                                 | Checks that /ai.txt is valid in the aitxt.ing or Spawning format.                                                              | `files`, `agent`                                                     |
| `caa`                                    | Requires the domain to publish syntactically valid CAA records that include an issue property.                                 | `internetnl`, `tls`, `dns`                                           |
| `cache-control`                          | Requires Cache-Control: no-store, max-age=0 on private applications (opt-in with the enforce option).                          | `owasp`, `security-headers`                                          |
| `cert-hostname`                          | Requires the host name of the website to match a name on its HTTPS certificate.                                                | `internetnl`, `security-headers`, `tls`                              |
| `cert-pubkey`                            | Requires every certificate in the HTTPS chain to use a secure public key type and size.                                        | `internetnl`, `security-headers`, `tls`                              |
| `cert-signature`                         | Requires every certificate in the HTTPS chain to be signed with a secure algorithm and hash function.                          | `internetnl`, `security-headers`, `tls`                              |
| `cert-trust`                             | Requires the HTTPS certificate to chain to a trusted root, with all intermediates sent.                                        | `internetnl`, `security-headers`, `tls`                              |
| `clear-site-data`                        | Requires the logout response to send Clear-Site-Data for cache, cookies and storage.                                           | `owasp`, `security-headers`                                          |
| `coep`                                   | Checks that Cross-Origin-Embedder-Policy requires embedded resources to opt in.                                                | `observatory`, `owasp`, `security-headers`                           |
| `cookies`                                | Checks that cookies use Secure, HttpOnly for sessions and SameSite.                                                            | `observatory`, `security-headers`, `privacy`                         |
| `coop`                                   | Checks that Cross-Origin-Opener-Policy isolates the page from windows it did not open.                                         | `observatory`, `owasp`, `security-headers`                           |
| `corp`                                   | Checks that Cross-Origin-Resource-Policy limits who may load the page as a resource.                                           | `observatory`, `owasp`, `security-headers`                           |
| `cors`                                   | Checks that Access-Control-Allow-Origin does not let any site make credentialed requests.                                      | `observatory`, `security-headers`                                    |
| `csp`                                    | Checks that a Content Security Policy is set and does not allow unsafe sources.                                                | `observatory`, `owasp`, `webbkoll`, `security-headers`               |
| `csp-reporting`                          | Reports CSP, report-only and NEL report endpoints that point to a third-party domain.                                          | `webbkoll`, `security-headers`, `privacy`                            |
| `dane-exists`                            | Checks that the website domain publishes a signed TLSA record for DANE.                                                        | `internetnl`, `tls`, `dns`                                           |
| `dane-valid`                             | Requires the DANE TLSA record of the website domain to match the web certificate.                                              | `internetnl`, `tls`, `dns`                                           |
| `dnssec-exists`                          | Requires the domain of the site to be DNSSEC signed.                                                                           | `internetnl`, `dns`                                                  |
| `dnssec-valid`                           | Requires the DNSSEC signature of the domain to be valid.                                                                       | `internetnl`, `dns`                                                  |
| `expect-ct`                              | Reports the deprecated Expect-CT header when it is sent.                                                                       | `owasp`, `security-headers`                                          |
| `feature-policy`                         | Reports the deprecated Feature-Policy header when it is sent.                                                                  | `owasp`, `security-headers`                                          |
| `geo-content-extraction`                 | Reports pages whose content lacks heading and paragraph structure.                                                             | `llmscout`, `seo`, `agent`                                           |
| `geo-faq-schema`                         | Reports pages without FAQPage JSON-LD.                                                                                         | `llmscout`, `seo`, `agent`                                           |
| `geo-organization-schema`                | Reports pages without Organization or Person JSON-LD that links profiles with sameAs.                                          | `llmscout`, `seo`, `agent`                                           |
| `geo-speakable-schema`                   | Reports pages without Speakable JSON-LD.                                                                                       | `llmscout`, `seo`, `agent`                                           |
| `geo-structured-data-invalid`            | Reports JSON-LD blocks that are not valid JSON.                                                                                | `llmscout`, `seo`, `agent`                                           |
| `hsts`                                   | Checks the Strict-Transport-Security header: HTTPS only, max-age and subdomain coverage.                                       | `observatory`, `owasp`, `webbkoll`, `internetnl`, `security-headers` |
| `icons-favicon-32-missing`               | Reports sites without a 32x32 PNG favicon link.                                                                                | `opengraph`, `seo`                                                   |
| `icons-favicon-ico-or-png-missing`       | Warns when there is no .ico or .png favicon (Google Search does not support SVG favicons).                                     | `opengraph`, `seo`                                                   |
| `icons-favicon-missing`                  | Reports sites that declare no favicon and serve no /favicon.ico.                                                               | `opengraph`, `seo`                                                   |
| `icons-favicon-svg-missing`              | Reports sites without an SVG favicon link.                                                                                     | `opengraph`, `seo`                                                   |
| `internetnl-http-compression`            | Reports when the web server compresses the root document (BREACH risk).                                                        | `internetnl`, `security-headers`                                     |
| `ipv6-ns-aaaa`                           | Requires at least two name servers of the domain to have an IPv6 address.                                                      | `internetnl`, `dns`                                                  |
| `ipv6-ns-reach`                          | Requires every name server with an IPv6 address to be reachable over IPv6.                                                     | `internetnl`, `dns`                                                  |
| `ipv6-same-content`                      | Requires the website over IPv6 to offer the same ports, headers and content as over IPv4.                                      | `internetnl`, `dns`                                                  |
| `ipv6-web-aaaa`                          | Requires the web server to have at least one IPv6 address.                                                                     | `internetnl`, `dns`                                                  |
| `ipv6-web-reach`                         | Requires every IPv6 address of the web server to be reachable over IPv6.                                                       | `internetnl`, `dns`                                                  |
| `llms-full-txt`                          | Checks that /llms-full.txt is non-empty markdown that parses.                                                                  | `files`, `agent`                                                     |
| `llms-txt`                               | Checks that /llms.txt follows the llmstxt.org format.                                                                          | `files`, `agent`                                                     |
| `mail-dane`                              | Requires the mail servers (MX) of the site domain to publish DNSSEC-signed TLSA records that match their certificates.         | `internetnl`, `tls`, `dns`, `email`                                  |
| `mail-dkim`                              | Requires the DKIM selectors given in the options to have valid key records under the site domain.                              | `internetnl`, `dns`, `email`                                         |
| `mail-dmarc`                             | Requires the site domain to publish a valid DMARC record with a policy other than none and valid report addresses.             | `internetnl`, `dns`, `email`                                         |
| `mail-dnssec`                            | Requires the site domain and the domains of its mail servers (MX) to be DNSSEC signed with a valid signature.                  | `internetnl`, `dns`, `email`                                         |
| `mail-ipv6`                              | Requires the mail servers (MX) of the site domain to have IPv6 addresses that are reachable on port 25.                        | `internetnl`, `dns`, `email`                                         |
| `mail-rpki`                              | Requires the routes of the IP addresses of the mail servers (MX) to be covered by valid RPKI Route Origin Authorisations.      | `internetnl`, `dns`, `email`                                         |
| `mail-spf`                               | Requires the site domain to have a valid SPF record within the 10 lookup limit that ends in -all or ~all.                      | `internetnl`, `dns`, `email`                                         |
| `mail-starttls`                          | Requires the mail servers (MX) of the site domain to offer STARTTLS, negotiate TLS 1.2 or 1.3 and present a valid certificate. | `internetnl`, `tls`, `email`                                         |
| `opengraph-description-could-be-longer`  | Flags an og:description of 50 to 70 characters.                                                                                | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-is-url`           | Flags an og:description that starts with a URL.                                                                                | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-keyword-stuffing` | Flags an og:description that repeats the same word excessively.                                                                | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-missing`          | Requires an og:description meta tag.                                                                                           | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-same-as-title`    | Flags an og:description identical to the og:title.                                                                             | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-slightly-long`    | Flags an og:description of 161 to 200 characters.                                                                              | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-too-long`         | Flags an og:description of more than 160 characters.                                                                           | `opengraph`, `seo`, `social`                                         |
| `opengraph-description-too-short`        | Flags an og:description shorter than 50 characters.                                                                            | `opengraph`, `seo`, `social`                                         |
| `opengraph-image-alt-missing`            | Requires og:image:alt next to og:image.                                                                                        | `opengraph`, `seo`, `social`                                         |
| `opengraph-image-broken`                 | Requires the og:image URL to return an image.                                                                                  | `opengraph`, `social`                                                |
| `opengraph-image-dimensions-missing`     | Requires og:image:width and og:image:height next to og:image.                                                                  | `opengraph`, `social`                                                |
| `opengraph-image-dimensions-too-large`   | Flags an og:image over 4096 pixels on a side.                                                                                  | `opengraph`, `social`                                                |
| `opengraph-image-missing`                | Requires an og:image meta tag.                                                                                                 | `opengraph`, `social`                                                |
| `opengraph-image-non-optimal-size`       | Flags an og:image that is not 1200x630 pixels (1.91:1).                                                                        | `opengraph`, `social`                                                |
| `opengraph-image-not-https`              | Requires the og:image URL to use HTTPS.                                                                                        | `opengraph`, `social`                                                |
| `opengraph-image-too-large`              | Flags an og:image over WhatsApp's 500 KB limit.                                                                                | `opengraph`, `social`                                                |
| `opengraph-image-too-small`              | Flags an og:image below the minimum size of social platforms.                                                                  | `opengraph`, `social`                                                |
| `opengraph-locale-missing`               | Requires an og:locale meta tag.                                                                                                | `opengraph`, `social`                                                |
| `opengraph-site-name-missing`            | Requires an og:site_name meta tag.                                                                                             | `opengraph`, `social`                                                |
| `opengraph-title-missing`                | Requires an og:title meta tag.                                                                                                 | `opengraph`, `seo`, `social`                                         |
| `opengraph-title-too-long`               | Requires og:title to be 60 characters or fewer.                                                                                | `opengraph`, `seo`, `social`                                         |
| `opengraph-title-too-short`              | Flags an og:title shorter than 15 characters.                                                                                  | `opengraph`, `seo`, `social`                                         |
| `opengraph-type-missing`                 | Requires an og:type meta tag.                                                                                                  | `opengraph`, `social`                                                |
| `opengraph-url-missing`                  | Requires an og:url meta tag.                                                                                                   | `opengraph`, `seo`, `social`                                         |
| `permissions-policy`                     | Requires the Permissions-Policy header to disable the browser features listed by OWASP.                                        | `owasp`, `security-headers`                                          |
| `privacy-cookies`                        | Counts first-party and third-party cookies set by responses and by script.                                                     | `webbkoll`, `privacy`                                                |
| `privacy-geolocation`                    | Finds inline and loaded scripts that use the Geolocation API.                                                                  | `webbkoll`, `privacy`                                                |
| `privacy-insecure-first-party`           | Finds requests to the page’s own domain that use http although the page uses https.                                            | `webbkoll`, `security-headers`, `privacy`                            |
| `privacy-local-storage`                  | Reports data the page stores in localStorage.                                                                                  | `webbkoll`, `privacy`                                                |
| `privacy-mixed-content`                  | Finds insecure subresources loaded by a page served over https.                                                                | `webbkoll`, `security-headers`, `privacy`                            |
| `privacy-third-party-requests`           | Lists requests to hosts outside the page’s registrable domain, by host and type.                                               | `webbkoll`, `privacy`                                                |
| `public-key-pins`                        | Reports the deprecated Public-Key-Pins header when it is sent.                                                                 | `owasp`, `security-headers`                                          |
| `redirection`                            | Checks that http:// redirects to https:// on the same host before any other redirect.                                          | `observatory`, `internetnl`, `security-headers`                      |
| `referrer-policy`                        | Checks that a Referrer-Policy is set and does not leak the full URL to other sites.                                            | `observatory`, `owasp`, `webbkoll`, `security-headers`, `privacy`    |
| `robots-txt`                             | Checks that robots.txt follows RFC 9309, including Content-Signal lines.                                                       | `files`, `seo`, `agent`                                              |
| `rpki-ns-exists`                         | Requires an RPKI ROA to be published for every IP address of the name servers.                                                 | `internetnl`, `dns`                                                  |
| `rpki-ns-valid`                          | Requires the route announcements of the name server IP addresses to be RPKI valid.                                             | `internetnl`, `dns`                                                  |
| `rpki-web-exists`                        | Requires an RPKI ROA to be published for every IP address of the web server.                                                   | `internetnl`, `dns`                                                  |
| `rpki-web-valid`                         | Requires the route announcements of the web server IP addresses to be RPKI valid.                                              | `internetnl`, `dns`                                                  |
| `security-txt`                           | Checks that /.well-known/security.txt follows RFC 9116.                                                                        | `files`, `security-headers`                                          |
| `seo-canonical-mismatch`                 | Reports a canonical URL that differs from the page URL.                                                                        | `opengraph`, `seo`                                                   |
| `seo-canonical-missing`                  | Reports pages without <link rel="canonical">.                                                                                  | `opengraph`, `seo`                                                   |
| `seo-h1-missing`                         | Warns when the page has no <h1> heading.                                                                                       | `opengraph`, `seo`                                                   |
| `seo-h1-multiple`                        | Reports pages with more than one <h1>.                                                                                         | `opengraph`, `seo`                                                   |
| `seo-html-lang-missing`                  | Warns when <html> has no lang attribute.                                                                                       | `opengraph`, `seo`                                                   |
| `seo-meta-description-missing`           | Requires a <meta name="description"> tag.                                                                                      | `opengraph`, `seo`                                                   |
| `seo-meta-description-too-long`          | Reports a meta description longer than 160 characters.                                                                         | `opengraph`, `seo`                                                   |
| `seo-meta-description-too-short`         | Reports a meta description shorter than 50 characters.                                                                         | `opengraph`, `seo`                                                   |
| `seo-robots-nofollow`                    | Reports when the robots meta tag contains nofollow.                                                                            | `opengraph`, `seo`                                                   |
| `seo-robots-noindex`                     | Warns when the robots meta tag contains noindex.                                                                               | `opengraph`, `seo`                                                   |
| `seo-structured-data-missing`            | Reports pages without a JSON-LD block.                                                                                         | `opengraph`, `seo`                                                   |
| `seo-title-missing`                      | Requires a non-empty <title> element in the head.                                                                              | `opengraph`, `seo`                                                   |
| `seo-title-too-long`                     | Warns when the <title> is longer than 70 characters.                                                                           | `opengraph`, `seo`                                                   |
| `seo-title-too-short`                    | Reports a <title> shorter than 10 characters.                                                                                  | `opengraph`, `seo`                                                   |
| `technical-canonical-invalid`            | Requires the canonical link href to be a valid URL, absolute or relative.                                                      | `llmscout`, `seo`                                                    |
| `technical-heading-hierarchy`            | Warns when a heading jumps down more than one level, such as an h2 followed by an h4.                                          | `llmscout`, `seo`                                                    |
| `technical-image-alt-coverage`           | Checks that img elements carry an alt attribute (warns from 80% coverage, errors below).                                       | `llmscout`, `seo`                                                    |
| `technical-image-weight`                 | Warns when an image is over 200 KB and errors when it is over 500 KB.                                                          | `llmscout`, `seo`                                                    |
| `technical-redirect-chain`               | Warns about long redirect chains and chains ending in an error.                                                                | `llmscout`, `seo`                                                    |
| `technical-robots-meta-advanced`         | Warns when the robots meta tag lacks max-snippet, max-image-preview or max-video-preview.                                      | `llmscout`, `seo`                                                    |
| `technical-twitter-card-type`            | Requires twitter:card to be summary, summary_large_image, app or player.                                                       | `llmscout`, `seo`, `social`                                          |
| `tls-cipher-order`                       | Requires the HTTPS server to enforce its own preference for the most secure cipher suites.                                     | `internetnl`, `security-headers`, `tls`                              |
| `tls-ciphers`                            | Requires the HTTPS server to accept only secure (good or sufficient) cipher suites.                                            | `internetnl`, `security-headers`, `tls`                              |
| `tls-compression`                        | Requires the HTTPS server not to support TLS compression.                                                                      | `internetnl`, `security-headers`, `tls`                              |
| `tls-ems`                                | Requires the HTTPS server to support the TLS 1.2 Extended Master Secret (RFC 7627).                                            | `internetnl`, `security-headers`, `tls`                              |
| `tls-kex-hash`                           | Requires the HTTPS server not to sign the TLS key exchange with weak hash functions (SHA-1, SHA-224).                          | `internetnl`, `security-headers`, `tls`                              |
| `tls-kex-params`                         | Requires the ephemeral Diffie-Hellman parameters of the HTTPS server (DH size, EC curves) to be secure.                        | `internetnl`, `security-headers`, `tls`                              |
| `tls-ocsp-stapling`                      | Checks that the HTTPS server staples an OCSP response when its certificate has an OCSP pointer.                                | `internetnl`, `security-headers`, `tls`                              |
| `tls-renegotiation-client`               | Checks that the HTTPS server does not allow unlimited client-initiated renegotiation.                                          | `internetnl`, `security-headers`, `tls`                              |
| `tls-renegotiation-secure`               | Requires the HTTPS server to support secure renegotiation (RFC 5746).                                                          | `internetnl`, `security-headers`, `tls`                              |
| `tls-version`                            | Requires the HTTPS server to accept only secure TLS versions (TLS 1.3 and TLS 1.2).                                            | `internetnl`, `security-headers`, `tls`                              |
| `tls-zero-rtt`                           | Requires the HTTPS server not to accept TLS 1.3 0-RTT early data.                                                              | `internetnl`, `security-headers`, `tls`                              |
| `twitter-card-missing`                   | Requires a twitter:card meta tag.                                                                                              | `opengraph`, `social`                                                |
| `twitter-card-not-large`                 | Suggests summary_large_image instead of summary.                                                                               | `opengraph`, `social`                                                |
| `twitter-description-missing`            | Requires a twitter:description meta tag.                                                                                       | `opengraph`, `social`                                                |
| `twitter-image-missing`                  | Requires a twitter:image meta tag.                                                                                             | `opengraph`, `social`                                                |
| `twitter-site-missing`                   | Requires a twitter:site meta tag.                                                                                              | `opengraph`, `social`                                                |
| `twitter-title-missing`                  | Requires a twitter:title meta tag.                                                                                             | `opengraph`, `social`                                                |
| `x-dns-prefetch-control`                 | Requires the X-DNS-Prefetch-Control header to be set to off.                                                                   | `owasp`, `security-headers`, `privacy`                               |
| `x-frame-options`                        | Checks that the page cannot be framed by other sites, with X-Frame-Options or CSP frame-ancestors.                             | `observatory`, `owasp`, `webbkoll`, `internetnl`, `security-headers` |
| `x-permitted-cross-domain-policies`      | Requires the X-Permitted-Cross-Domain-Policies header to be set to none.                                                       | `owasp`, `security-headers`                                          |
| `x-xss-protection`                       | Reports the deprecated X-XSS-Protection header when it is sent.                                                                | `owasp`, `webbkoll`, `security-headers`                              |

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
| [LLMScout](https://github.com/RudrenduPaul/LLMScout)                                                                        | Technical SEO and generative-engine checks: heading hierarchy, image alt and weight, redirect chain, FAQ, Speakable and Organization schema | MIT                                 |
| [Internet.nl](https://github.com/internetstandards/Internet.nl)                                                             | IPv6, DNSSEC, DANE, RPKI, CAA, TLS, certificate and email checks                                                                            | Apache-2.0 (code), CC-BY-4.0 (docs) |

Not used: Webbkoll's tracker-name list (`services.json`) is Disconnect's data under CC BY-NC-SA, so hosts are listed without tracker labels.

### Sources considered later

Lighthouse audits, Google Search Central structured-data rules, Spectral and Redocly OpenAPI rules, Zalando's API ruleset, axe rules, sitespeed.io Coach advice, the IANA well-known URI and link-relation registries, and the WHATWG meta-name registry are candidates for the next round.

## Licence

Apache-2.0
