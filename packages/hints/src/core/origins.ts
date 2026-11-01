/**
 * Where each hint came from: the upstream check, its page, and a summary.
 * Hints written for this package have no entry. Summaries of sites that
 * carry no open licence are in our own words.
 */
export interface Origin {
  /** The source group, see `sources.ts`. */
  source: string;
  /** The check, test or article as the upstream names it. */
  upstreamId: string;
  title: string;
  /** The code or page of the check. */
  url: string;
  /** A documentation page, or an empty string. */
  docsUrl: string;
  summary: string;
  licence: string;
}

export const ORIGINS: Readonly<Record<string, readonly Origin[]>> = {
  'agent-a2a-agent-card': [
    {
      source: 'agent-ready',
      upstreamId: 'A2A Agent Card',
      title: 'A2A Agent Card (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://a2a-protocol.org/latest/specification/',
      summary:
        'Fetches the agent card at the A2A well-known path (or the legacy agent.json) and validates it.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-acp': [
    {
      source: 'agent-ready',
      upstreamId: 'ACP',
      title: 'ACP (Commerce)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/rfcs/rfc.discovery.md',
      summary:
        'Fetches the /.well-known/acp.json discovery document; informational.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-ai-bot-rules': [
    {
      source: 'agent-ready',
      upstreamId: 'AI bot rules in robots.txt',
      title: 'AI bot rules (Bot Access Control)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9309',
      summary:
        'Checks robots.txt for User-agent entries naming known AI crawlers; wildcard-only rules do not count.',
      licence: 'IETF',
    },
  ],
  'agent-api-catalog': [
    {
      source: 'agent-ready',
      upstreamId: 'API Catalog',
      title: 'API Catalog (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9727',
      summary:
        'Fetches /.well-known/api-catalog as linkset+json and expects entries with an anchor and service-desc, service-doc or status links.',
      licence: 'IETF',
    },
  ],
  'agent-ard': [
    {
      source: 'agent-ready',
      upstreamId: 'ARD',
      title: 'ARD (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://agenticresourcediscovery.org/spec',
      summary:
        'Checks /.well-known/ai-catalog.json for a catalog with host, entries having urn ids, display names and sample queries.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-auth-md': [
    {
      source: 'agent-ready',
      upstreamId: 'Auth.md',
      title: 'Auth.md (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: '',
      summary:
        'Checks that /auth.md exists to give agents registration instructions.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-content-signals': [
    {
      source: 'agent-ready',
      upstreamId: 'Content Signals',
      title: 'Content Signals (Bot Access Control)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://blog.cloudflare.com/content-signals-policy/',
      summary:
        'Checks robots.txt for a Content-Signal directive declaring ai-train, search and ai-input preferences.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-dns-aid': [
    {
      source: 'agent-ready',
      upstreamId: 'DNS for AI Discovery (DNS-AID)',
      title: 'DNS for AI Discovery (Discoverability)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/',
      summary:
        'Queries SVCB, HTTPS and TXT records under _agents labels for index, A2A and MCP and passes on service-mode records with endpoint parameters.',
      licence: 'IETF',
    },
  ],
  'agent-link-headers': [
    {
      source: 'agent-ready',
      upstreamId: 'Link headers',
      title: 'Link headers (Discoverability)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://www.iana.org/assignments/link-relations/link-relations.xhtml',
      summary:
        'Parses the homepage Link header and passes only with an agent-useful relation such as api-catalog, service-desc or service-doc; preconnect alone fails.',
      licence: 'IETF',
    },
  ],
  'agent-markdown-negotiation': [
    {
      source: 'agent-ready',
      upstreamId: 'Markdown negotiation',
      title: 'Markdown negotiation (Content Accessibility)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/',
      summary:
        'Requests a page with Accept: text/markdown and passes only if the response is served as text/markdown.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-mcp-server-card': [
    {
      source: 'agent-ready',
      upstreamId: 'MCP Server Card',
      title: 'MCP Server Card (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649',
      summary:
        'Looks for a server card under the .well-known mcp paths with server name, version, transport endpoint and capabilities.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-mpp': [
    {
      source: 'agent-ready',
      upstreamId: 'MPP',
      title: 'MPP (Commerce)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://mpp.dev',
      summary:
        'Looks in /openapi.json for machine payment information; informational.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-oauth-discovery': [
    {
      source: 'agent-ready',
      upstreamId: 'OAuth/OIDC discovery',
      title: 'OAuth/OIDC discovery (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc8414',
      summary:
        'Fetches openid-configuration or oauth-authorization-server metadata and requires JSON with a valid issuer.',
      licence: 'IETF',
    },
  ],
  'agent-oauth-protected-resource': [
    {
      source: 'agent-ready',
      upstreamId: 'OAuth Protected Resource',
      title: 'OAuth Protected Resource (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9728',
      summary:
        'Fetches /.well-known/oauth-protected-resource and expects JSON whose resource matches the site.',
      licence: 'IETF',
    },
  ],
  'agent-poppy': [
    {
      source: 'agent-ready',
      upstreamId: 'Personal Agent Protocol (Poppy)',
      title: 'Personal Agent Protocol (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://personalagentprotocol.org',
      summary:
        'Checks /.well-known/poppy.json for protocol version, organization details matching the host and at least one agent, API or web section.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-robots-txt': [
    {
      source: 'agent-ready',
      upstreamId: 'robots.txt',
      title: 'robots.txt (Discoverability)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9309',
      summary:
        'Expects /robots.txt to return 200 as text/plain and contain at least one valid User-agent directive.',
      licence: 'IETF',
    },
  ],
  'agent-score': [
    {
      source: 'agent-ready',
      upstreamId: 'Overall score',
      title: 'Agent readiness score and level',
      url: 'https://isitagentready.com',
      docsUrl: '',
      summary:
        'The site aggregates category results into a 0 to 100 score and a named level.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-sitemap': [
    {
      source: 'agent-ready',
      upstreamId: 'Sitemap',
      title: 'Sitemap (Discoverability)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://www.sitemaps.org/protocol.html',
      summary:
        'Looks for Sitemap directives in robots.txt, or /sitemap.xml, that resolve to a valid XML sitemap.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'XML sitemap',
      title: 'XML sitemap (Indexing)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that a valid XML sitemap exists.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-skills': [
    {
      source: 'agent-ready',
      upstreamId: 'Agent Skills',
      title: 'Agent Skills (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://github.com/cloudflare/agent-skills-discovery-rfc',
      summary:
        'Checks the agent-skills index.json lists skills with name, type, description, url and sha256 digest.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-ucp': [
    {
      source: 'agent-ready',
      upstreamId: 'UCP',
      title: 'UCP (Commerce)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://ucp.dev/latest/specification/overview/',
      summary: 'Fetches the /.well-known/ucp profile; informational.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-web-bot-auth': [
    {
      source: 'agent-ready',
      upstreamId: 'Web Bot Auth',
      title: 'Web Bot Auth (Bot Access Control)',
      url: 'https://isitagentready.com',
      docsUrl:
        'https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/',
      summary:
        'Expects /.well-known/http-message-signatures-directory to respond 200 with a key directory.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-webmcp': [
    {
      source: 'agent-ready',
      upstreamId: 'WebMCP',
      title: 'WebMCP (API, Auth, MCP)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://webmachinelearning.github.io/webmcp/',
      summary:
        'Loads the page in a browser and passes if tools are registered through the modelContext API or declarative forms.',
      licence: 'unlicensed site content',
    },
  ],
  'agent-x402': [
    {
      source: 'agent-ready',
      upstreamId: 'x402',
      title: 'x402 (Commerce)',
      url: 'https://isitagentready.com',
      docsUrl: 'https://docs.x402.org',
      summary:
        'Probes the root and common API paths for an HTTP 402 payment response; informational unless commerce is detected.',
      licence: 'unlicensed site content',
    },
  ],
  'ai-txt': [
    {
      source: 'files',
      upstreamId: 'ai.txt',
      title: 'ai.txt validator',
      url: 'https://llmstxtvalidator.dev',
      docsUrl: 'https://aitxt.ing',
      summary: 'Validates ai.txt AI usage-permission declarations.',
      licence: 'unlicensed site content',
    },
  ],
  caa: [
    {
      source: 'internetnl',
      upstreamId: 'WebCaa',
      title: 'CAA for domain',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1325',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebCaa: Requires the domain to publish syntactically valid CAA records that include an issue property.',
      licence: 'Apache-2.0',
    },
  ],
  'cache-control': [
    {
      source: 'owasp',
      upstreamId: 'Cache-Control',
      title: 'Cache-Control (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary: 'Expects Cache-Control no-store, max-age=0 for private content.',
      licence: 'Apache-2.0',
    },
  ],
  'cert-hostname': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCertHostmatch',
      title: 'Domain name on certificate',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1302',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCertHostmatch: Requires the host name of the website to match a name on its HTTPS certificate.',
      licence: 'Apache-2.0',
    },
  ],
  'cert-pubkey': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCertPubkey',
      title: 'Public key of certificate',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1245',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCertPubkey: Requires every certificate in the HTTPS chain to use a secure public key type and size.',
      licence: 'Apache-2.0',
    },
  ],
  'cert-signature': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCertSignature',
      title: 'Signature on certificate',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1273',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCertSignature: Requires every certificate in the HTTPS chain to be signed with a secure algorithm and hash function.',
      licence: 'Apache-2.0',
    },
  ],
  'cert-trust': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCertTrust',
      title: 'Trust chain of certificate',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1219',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCertTrust: Requires the HTTPS certificate to chain to a trusted root, with all intermediates sent.',
      licence: 'Apache-2.0',
    },
  ],
  'clear-site-data': [
    {
      source: 'owasp',
      upstreamId: 'Clear-Site-Data',
      title: 'Clear-Site-Data (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'Expects Clear-Site-Data on logout responses to clear cache, cookies and storage.',
      licence: 'Apache-2.0',
    },
  ],
  coep: [
    {
      source: 'observatory',
      upstreamId: 'crossOriginEmbedderPolicyTest',
      title: 'Cross-Origin-Embedder-Policy',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/cross-origin-embedder-policy.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks that Cross-Origin-Embedder-Policy is set so embedded resources must opt in.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Cross-Origin-Embedder-Policy',
      title: 'Cross-Origin-Embedder-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Cross-Origin-Embedder-Policy header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
  ],
  cookies: [
    {
      source: 'observatory',
      upstreamId: 'cookiesTest',
      title: 'Cookies',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/cookies.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Inspects Set-Cookie headers for the Secure, HttpOnly and SameSite attributes and cookie prefixes.',
      licence: 'MPL-2.0',
    },
  ],
  coop: [
    {
      source: 'observatory',
      upstreamId: 'crossOriginOpenerPolicyTest',
      title: 'Cross-Origin-Opener-Policy',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/cross-origin-opener-policy.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks that Cross-Origin-Opener-Policy is set to a value that isolates the page from cross-origin windows.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Cross-Origin-Opener-Policy',
      title: 'Cross-Origin-Opener-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Cross-Origin-Opener-Policy header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
  ],
  corp: [
    {
      source: 'observatory',
      upstreamId: 'crossOriginResourcePolicyTest',
      title: 'Cross-Origin-Resource-Policy',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/cross-origin-resource-policy.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks that Cross-Origin-Resource-Policy restricts which origins can load the resource.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Cross-Origin-Resource-Policy',
      title: 'Cross-Origin-Resource-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Cross-Origin-Resource-Policy header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
  ],
  cors: [
    {
      source: 'observatory',
      upstreamId: 'crossOriginResourceSharingTest',
      title: 'Cross-origin resource sharing',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/cors.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks Access-Control-Allow-Origin and related headers for overly permissive access, such as wildcard origins combined with credentials.',
      licence: 'MPL-2.0',
    },
  ],
  csp: [
    {
      source: 'observatory',
      upstreamId: 'contentSecurityPolicyTest',
      title: 'Content Security Policy',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/csp.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Scores the CSP header, penalising unsafe-inline, unsafe-eval, insecure schemes and missing base-uri, form-action or frame-ancestors restrictions.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Content-Security-Policy',
      title: 'Content-Security-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Content-Security-Policy header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
    {
      source: 'webbkoll',
      upstreamId: 'csp/3',
      title: 'Content Security Policy',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/header_analysis.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Parses the CSP header and meta tag and grades the policy by unsafe-inline, unsafe-eval and insecure sources.',
      licence: 'MIT',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebAppsecprivHttpCsp',
      title: 'Content Security Policy',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2543',
      docsUrl: 'https://internet.nl/faqs/appsecpriv/',
      summary:
        'Internet.nl subtest WebAppsecprivHttpCsp: Checks that the site sends a Content Security Policy that restricts where content may be loaded from.',
      licence: 'Apache-2.0',
    },
  ],
  'csp-reporting': [
    {
      source: 'webbkoll',
      upstreamId: 'external_report/5',
      title: 'External reporting',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/header_analysis.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Detects CSP, report-only and NEL reporting endpoints on third-party domains.',
      licence: 'MIT',
    },
  ],
  'dane-exists': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsDaneExists',
      title: 'DANE existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1367',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsDaneExists: Checks that the website domain publishes a signed TLSA record for DANE.',
      licence: 'Apache-2.0',
    },
  ],
  'dane-valid': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsDaneValid',
      title: 'DANE validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1393',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsDaneValid: Requires the DANE TLSA record of the website domain to match the web certificate.',
      licence: 'Apache-2.0',
    },
  ],
  'dnssec-exists': [
    {
      source: 'internetnl',
      upstreamId: 'WebDnssecExists',
      title: 'DNSSEC existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L671',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest WebDnssecExists: Requires the domain of the site to be DNSSEC signed.',
      licence: 'Apache-2.0',
    },
  ],
  'dnssec-valid': [
    {
      source: 'internetnl',
      upstreamId: 'WebDnssecValid',
      title: 'DNSSEC validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L702',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest WebDnssecValid: Requires the DNSSEC signature of the domain to be valid.',
      licence: 'Apache-2.0',
    },
  ],
  'expect-ct': [
    {
      source: 'owasp',
      upstreamId: 'Expect-CT',
      title: 'Expect-CT (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary: 'Flags the obsolete Expect-CT header, which should not be sent.',
      licence: 'Apache-2.0',
    },
  ],
  'feature-policy': [
    {
      source: 'owasp',
      upstreamId: 'Feature-Policy',
      title: 'Feature-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'Flags the obsolete Feature-Policy header, which should not be sent.',
      licence: 'Apache-2.0',
    },
  ],
  'geo-content-extraction': [
    {
      source: 'llmscout',
      upstreamId: 'content-extraction',
      title: 'Content extraction',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/geo/content-extraction.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary:
        'Checks the page has heading and paragraph structure that is easy to extract.',
      licence: 'MIT',
    },
  ],
  'geo-faq-schema': [
    {
      source: 'llmscout',
      upstreamId: 'faq-schema',
      title: 'FAQPage structured data',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/geo/faq-schema.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Looks for FAQPage JSON-LD on the page.',
      licence: 'MIT',
    },
  ],
  'geo-organization-schema': [
    {
      source: 'llmscout',
      upstreamId: 'organization-schema',
      title: 'Organization schema with sameAs',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/geo/organization-schema.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary:
        'Looks for Organization or Person JSON-LD with sameAs profile links.',
      licence: 'MIT',
    },
  ],
  'geo-speakable-schema': [
    {
      source: 'llmscout',
      upstreamId: 'speakable-schema',
      title: 'Speakable structured data',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/geo/speakable-schema.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Looks for Speakable JSON-LD.',
      licence: 'MIT',
    },
  ],
  'geo-structured-data-invalid': [
    {
      source: 'llmscout',
      upstreamId: 'structured-data',
      title: 'Structured data validity',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/geo/structured-data.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Checks that JSON-LD blocks parse as valid JSON.',
      licence: 'MIT',
    },
  ],
  hsts: [
    {
      source: 'observatory',
      upstreamId: 'strictTransportSecurityTest',
      title: 'Strict Transport Security',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/strict-transport-security.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks the Strict-Transport-Security header for a long enough max-age, includeSubDomains and preload.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Strict-Transport-Security',
      title: 'Strict-Transport-Security (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Strict-Transport-Security header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
    {
      source: 'webbkoll',
      upstreamId: 'hsts/1',
      title: 'HTTP Strict Transport Security',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/header_analysis.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Parses the HSTS header and reports max-age, includeSubDomains and preload.',
      licence: 'MIT',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebTlsHttpsHsts',
      title: 'HSTS',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L962',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsHttpsHsts: Checks the Strict-Transport-Security header: HTTPS only, max-age and subdomain coverage.',
      licence: 'Apache-2.0',
    },
    {
      source: 'roctify',
      upstreamId: 'HSTS header',
      title: 'HSTS header (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the Strict-Transport-Security header is sent.',
      licence: 'unlicensed site content',
    },
  ],
  'icons-favicon-32-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-favicon-32',
      title: 'Missing 32x32 Favicon [Info / General]',
      url: 'https://www.opengraph.to/articles/missing-favicon-32',
      docsUrl: '',
      summary: 'Notes that a 32x32 PNG favicon for crisp tabs is missing.',
      licence: 'unlicensed site content',
    },
  ],
  'icons-favicon-ico-or-png-missing': [
    {
      source: 'opengraph',
      upstreamId: 'favicon-icon-missing',
      title: 'Missing .ico or .png Favicon [Warning / General]',
      url: 'https://www.opengraph.to/articles/favicon-icon-missing',
      docsUrl: '',
      summary:
        'Warns that no .ico or .png favicon exists, which Google Search needs to show an icon.',
      licence: 'unlicensed site content',
    },
  ],
  'icons-favicon-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-favicon',
      title: 'Missing Favicon [Info / General]',
      url: 'https://www.opengraph.to/articles/missing-favicon',
      docsUrl: '',
      summary: 'Notes that no favicon exists for browser tabs and bookmarks.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Favicon',
      title: 'Favicon (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page declares a favicon.',
      licence: 'unlicensed site content',
    },
  ],
  'icons-favicon-svg-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-svg-favicon',
      title: 'No SVG Favicon Found [Info / General]',
      url: 'https://www.opengraph.to/articles/missing-svg-favicon',
      docsUrl: '',
      summary:
        'Notes that no SVG favicon exists for scalable, dark-mode-aware icons.',
      licence: 'unlicensed site content',
    },
  ],
  'internetnl-http-compression': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsHttpCompression',
      title: 'HTTP compression',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L990',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsHttpCompression: Reports when the web server compresses the root document (BREACH risk).',
      licence: 'Apache-2.0',
    },
    {
      source: 'roctify',
      upstreamId: 'Compression',
      title: 'Compression (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that responses are compressed.',
      licence: 'unlicensed site content',
    },
  ],
  'ipv6-ns-aaaa': [
    {
      source: 'internetnl',
      upstreamId: 'Ipv6NsAaaa',
      title: 'IPv6 addresses for name servers',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L460',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest Ipv6NsAaaa: Requires at least two name servers of the domain to have an IPv6 address.',
      licence: 'Apache-2.0',
    },
  ],
  'ipv6-ns-reach': [
    {
      source: 'internetnl',
      upstreamId: 'Ipv6NsReach',
      title: 'IPv6 reachability of name servers',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L486',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest Ipv6NsReach: Requires every name server with an IPv6 address to be reachable over IPv6.',
      licence: 'Apache-2.0',
    },
  ],
  'ipv6-same-content': [
    {
      source: 'internetnl',
      upstreamId: 'WebIpv6WsIpv46',
      title: 'Same website on IPv6 and IPv4',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L555',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest WebIpv6WsIpv46: Requires the website over IPv6 to offer the same ports, headers and content as over IPv4.',
      licence: 'Apache-2.0',
    },
  ],
  'ipv6-web-aaaa': [
    {
      source: 'internetnl',
      upstreamId: 'WebIpv6WsAaaa',
      title: 'IPv6 addresses for web server',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L510',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest WebIpv6WsAaaa: Requires the web server to have at least one IPv6 address.',
      licence: 'Apache-2.0',
    },
  ],
  'ipv6-web-reach': [
    {
      source: 'internetnl',
      upstreamId: 'WebIpv6WsReach',
      title: 'IPv6 reachability of web server',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L531',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest WebIpv6WsReach: Requires every IPv6 address of the web server to be reachable over IPv6.',
      licence: 'Apache-2.0',
    },
  ],
  'llms-full-txt': [
    {
      source: 'files',
      upstreamId: 'llms-full.txt',
      title: 'llms-full.txt validator',
      url: 'https://llmstxtvalidator.dev',
      docsUrl: 'https://llmstxt.org',
      summary:
        'Validates the llms-full.txt companion that inlines full content.',
      licence: 'unlicensed site content',
    },
  ],
  'llms-txt': [
    {
      source: 'files',
      upstreamId: 'llms.txt',
      title: 'llms.txt validator',
      url: 'https://llmstxtvalidator.dev',
      docsUrl: 'https://llmstxt.org',
      summary:
        'Validates the llms.txt Markdown structure: H1 title, summary and link sections.',
      licence: 'unlicensed site content',
    },
  ],
  'mail-dane': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsDaneValid',
      title: 'DANE validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2274',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsDaneValid: Requires the mail servers (MX) of the site domain to publish DNSSEC-signed TLSA records that match their certificates.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-dkim': [
    {
      source: 'internetnl',
      upstreamId: 'MailAuthDkim',
      title: 'DKIM existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2329',
      docsUrl: 'https://internet.nl/faqs/mailauth/',
      summary:
        'Internet.nl subtest MailAuthDkim: Requires the DKIM selectors given in the options to have valid key records under the site domain.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-dmarc': [
    {
      source: 'internetnl',
      upstreamId: 'MailAuthDmarc',
      title: 'DMARC existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2356',
      docsUrl: 'https://internet.nl/faqs/mailauth/',
      summary:
        'Internet.nl subtest MailAuthDmarc: Requires the site domain to publish a valid DMARC record with a policy other than none and valid report addresses.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailAuthDmarcPolicy',
      title: 'DMARC policy',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2386',
      docsUrl: 'https://internet.nl/faqs/mailauth/',
      summary:
        'Internet.nl subtest MailAuthDmarcPolicy: Checks that the DMARC policy of the site domain is strict enough to reject or quarantine spoofed mail.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-dnssec': [
    {
      source: 'internetnl',
      upstreamId: 'MailDnssecValid',
      title: 'DNSSEC validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L770',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest MailDnssecValid: Requires the site domain and the domains of its mail servers (MX) to be DNSSEC signed with a valid signature.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailDnssecExists',
      title: 'DNSSEC existence (mail domain)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L739',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest MailDnssecExists: Checks that the mail domain is signed with DNSSEC.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailDnssecMxExists',
      title: 'DNSSEC existence (mail servers)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L807',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest MailDnssecMxExists: Checks that the domains of the mail servers (MX) are signed with DNSSEC.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailDnssecMxValid',
      title: 'DNSSEC validity (mail servers)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L865',
      docsUrl: 'https://internet.nl/faqs/dnssec/',
      summary:
        'Internet.nl subtest MailDnssecMxValid: Checks that the DNSSEC signatures of the mail server domains (MX) validate.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-ipv6': [
    {
      source: 'internetnl',
      upstreamId: 'MailIpv6MxAaaa',
      title: 'IPv6 addresses for mail server(s)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L587',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest MailIpv6MxAaaa: Requires the mail servers (MX) of the site domain to have IPv6 addresses that are reachable on port 25.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailIpv6MxReach',
      title: 'IPv6 reachability of mail servers',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L638',
      docsUrl: 'https://internet.nl/faqs/ipv6/',
      summary:
        'Internet.nl subtest MailIpv6MxReach: Checks that the IPv6 addresses of the mail servers (MX) accept connections on port 25.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-rpki': [
    {
      source: 'internetnl',
      upstreamId: 'MailRpkiValid',
      title: 'Mail server RPKI validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L398',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest MailRpkiValid: Requires the routes of the IP addresses of the mail servers (MX) to be covered by valid RPKI Route Origin Authorisations.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-spf': [
    {
      source: 'internetnl',
      upstreamId: 'MailAuthSpf',
      title: 'SPF existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2421',
      docsUrl: 'https://internet.nl/faqs/mailauth/',
      summary:
        'Internet.nl subtest MailAuthSpf: Requires the site domain to have a valid SPF record within the 10 lookup limit that ends in -all or ~all.',
      licence: 'Apache-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'MailAuthSpfPolicy',
      title: 'SPF policy',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2451',
      docsUrl: 'https://internet.nl/faqs/mailauth/',
      summary:
        'Internet.nl subtest MailAuthSpfPolicy: Checks that the SPF record of the site domain ends in a policy that rejects or soft-fails mail from other servers.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-starttls': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsStarttlsExists',
      title: 'STARTTLS available',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1596',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsStarttlsExists: Requires the mail servers (MX) of the site domain to offer STARTTLS, negotiate TLS 1.2 or 1.3 and present a valid certificate.',
      licence: 'Apache-2.0',
    },
  ],
  'opengraph-description-could-be-longer': [
    {
      source: 'opengraph',
      upstreamId: 'description-could-be-longer',
      title: 'og:description Could Be Longer [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-could-be-longer',
      docsUrl: '',
      summary:
        'Suggests using more of the available room when the description is shorter than ideal.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-is-url': [
    {
      source: 'opengraph',
      upstreamId: 'description-is-url',
      title: 'og:description Contains a URL [Warning / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-is-url',
      docsUrl: '',
      summary:
        'Warns when the description is just a URL rather than readable prose.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-keyword-stuffing': [
    {
      source: 'opengraph',
      upstreamId: 'description-keyword-stuffing',
      title: 'Keyword Stuffing in og:description [Warning / SEO]',
      url: 'https://www.opengraph.to/articles/description-keyword-stuffing',
      docsUrl: '',
      summary:
        'Warns when the description repeats the same words excessively instead of reading naturally.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-description',
      title: 'Missing og:description [Error / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-description',
      docsUrl: '',
      summary:
        'Flags pages lacking an og:description summary for link previews.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Open Graph tags',
      title: 'Open Graph tags (Social media)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has the Open Graph tags used for link previews.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-same-as-title': [
    {
      source: 'opengraph',
      upstreamId: 'description-same-as-title',
      title: 'og:description Is Identical to og:title [Warning / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-same-as-title',
      docsUrl: '',
      summary: 'Warns when og:description merely repeats og:title.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-slightly-long': [
    {
      source: 'opengraph',
      upstreamId: 'description-slightly-long',
      title: 'og:description Slightly Long [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-slightly-long',
      docsUrl: '',
      summary:
        'Informational note for descriptions in the 160 to 200 character band that some platforms may clip.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-too-long': [
    {
      source: 'opengraph',
      upstreamId: 'description-too-long',
      title: 'og:description Is Too Long [Warning / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-too-long',
      docsUrl: '',
      summary:
        'Warns that descriptions beyond roughly 160 characters risk truncation.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-description-too-short': [
    {
      source: 'opengraph',
      upstreamId: 'description-too-short',
      title: 'og:description Is Too Short [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/description-too-short',
      docsUrl: '',
      summary:
        'Notes very short descriptions that waste the available preview space.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-alt-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-image-alt',
      title: 'Missing og:image:alt [Info / Image]',
      url: 'https://www.opengraph.to/articles/missing-og-image-alt',
      docsUrl: '',
      summary: 'Notes that og:image:alt text for accessibility is absent.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-broken': [
    {
      source: 'opengraph',
      upstreamId: 'broken-og-image',
      title: 'Broken og:image [Error / Image]',
      url: 'https://www.opengraph.to/articles/broken-og-image',
      docsUrl: '',
      summary: 'Flags an og:image URL that does not return a valid image.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-dimensions-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-image-dimensions',
      title: 'Missing og:image Dimensions [Warning / Image]',
      url: 'https://www.opengraph.to/articles/missing-image-dimensions',
      docsUrl: '',
      summary:
        'Warns that og:image:width and og:image:height are not declared.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-dimensions-too-large': [
    {
      source: 'opengraph',
      upstreamId: 'og-image-dimensions-too-large',
      title: 'OG Image Dimensions Too Large [Warning / Image]',
      url: 'https://www.opengraph.to/articles/og-image-dimensions-too-large',
      docsUrl: '',
      summary: 'Warns when the og:image exceeds 4096px on a side.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-image',
      title: 'Missing og:image [Error / Image]',
      url: 'https://www.opengraph.to/articles/missing-og-image',
      docsUrl: '',
      summary:
        'Flags pages with no og:image, which get far less engagement when shared.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Open Graph tags',
      title: 'Open Graph tags (Social media)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has the Open Graph tags used for link previews.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-non-optimal-size': [
    {
      source: 'opengraph',
      upstreamId: 'non-optimal-image-size',
      title: 'Non-Optimal OG Image Size [Info / Image]',
      url: 'https://www.opengraph.to/articles/non-optimal-image-size',
      docsUrl: '',
      summary: 'Notes that the image is not the recommended 1200x630 size.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-not-https': [
    {
      source: 'opengraph',
      upstreamId: 'image-not-https',
      title: 'OG Image Not Using HTTPS [Warning / Image]',
      url: 'https://www.opengraph.to/articles/image-not-https',
      docsUrl: '',
      summary:
        'Warns that an og:image served over plain HTTP may be blocked by some platforms.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-too-large': [
    {
      source: 'opengraph',
      upstreamId: 'og-image-too-large',
      title: 'OG Image Too Large [Warning / Image]',
      url: 'https://www.opengraph.to/articles/og-image-too-large',
      docsUrl: '',
      summary:
        'Warns when the og:image file is over 500 KB, which WhatsApp will not preview.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-image-too-small': [
    {
      source: 'opengraph',
      upstreamId: 'og-image-too-small',
      title: 'OG Image Too Small [Error / Image]',
      url: 'https://www.opengraph.to/articles/og-image-too-small',
      docsUrl: '',
      summary:
        'Flags an og:image below the minimum dimensions platforms will display properly.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-locale-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-locale',
      title: 'Missing og:locale [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-locale',
      docsUrl: '',
      summary:
        'Notes that og:locale, declaring language and region, is absent.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-site-name-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-site-name',
      title: 'Missing og:site_name [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-site-name',
      docsUrl: '',
      summary: 'Notes that og:site_name, used to show the brand, is absent.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-title-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-title',
      title: 'Missing og:title [Error / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-title',
      docsUrl: '',
      summary:
        'Flags pages with no og:title; scrapers then fall back to the page title or bare URL.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Open Graph tags',
      title: 'Open Graph tags (Social media)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has the Open Graph tags used for link previews.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-title-too-long': [
    {
      source: 'opengraph',
      upstreamId: 'title-too-long',
      title: 'og:title Is Too Long [Warning / Open Graph]',
      url: 'https://www.opengraph.to/articles/title-too-long',
      docsUrl: '',
      summary:
        'Warns when the og:title exceeds about 60 characters and may be cut off in previews.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-title-too-short': [
    {
      source: 'opengraph',
      upstreamId: 'title-too-short',
      title: 'og:title Is Too Short [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/title-too-short',
      docsUrl: '',
      summary:
        'Notes titles so brief they do not describe the page well on social cards.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-type-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-type',
      title: 'Missing og:type [Info / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-type',
      docsUrl: '',
      summary:
        'Notes that og:type, which tells platforms what kind of content the page is, is absent.',
      licence: 'unlicensed site content',
    },
  ],
  'opengraph-url-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-og-url',
      title: 'Missing og:url [Warning / Open Graph]',
      url: 'https://www.opengraph.to/articles/missing-og-url',
      docsUrl: '',
      summary:
        'Warns that og:url, the canonical address for the shared page, is absent.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Open Graph tags',
      title: 'Open Graph tags (Social media)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has the Open Graph tags used for link previews.',
      licence: 'unlicensed site content',
    },
  ],
  'permissions-policy': [
    {
      source: 'owasp',
      upstreamId: 'Permissions-Policy',
      title: 'Permissions-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'Expects a Permissions-Policy header that disables the powerful features OWASP lists.',
      licence: 'Apache-2.0',
    },
  ],
  'privacy-cookies': [
    {
      source: 'webbkoll',
      upstreamId: 'get_cookies/2',
      title: 'Cookies',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/worker.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Splits cookies into first-party and third-party and counts them.',
      licence: 'MIT',
    },
  ],
  'privacy-insecure-first-party': [
    {
      source: 'webbkoll',
      upstreamId: 'check_insecure_first_party/3',
      title: 'Insecure first-party requests',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/worker.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Lists requests to the site own registrable domain made over plain http.',
      licence: 'MIT',
    },
  ],
  'privacy-local-storage': [
    {
      source: 'webbkoll',
      upstreamId: '_localstorage.html.heex',
      title: 'localStorage',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll_web/templates/site/_localstorage.html.heex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary: 'Reports data the page stores in localStorage.',
      licence: 'MIT',
    },
  ],
  'privacy-mixed-content': [
    {
      source: 'webbkoll',
      upstreamId: '_https.html.heex#mixed-content',
      title: 'Mixed content',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll_web/templates/site/_https.html.heex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary: 'Reports insecure subresources loaded by an https page.',
      licence: 'MIT',
    },
    {
      source: 'roctify',
      upstreamId: 'Mixed content',
      title: 'Mixed content (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that an HTTPS page loads no HTTP resources.',
      licence: 'unlicensed site content',
    },
  ],
  'privacy-third-party-requests': [
    {
      source: 'webbkoll',
      upstreamId: '_requests.html.heex',
      title: 'Third-party requests',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll_web/templates/site/_requests.html.heex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary: 'Summarises requests to hosts outside the registrable domain.',
      licence: 'MIT',
    },
  ],
  'public-key-pins': [
    {
      source: 'owasp',
      upstreamId: 'Public-Key-Pins',
      title: 'Public-Key-Pins (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'Flags the obsolete Public-Key-Pins header, which should not be sent.',
      licence: 'Apache-2.0',
    },
  ],
  redirection: [
    {
      source: 'observatory',
      upstreamId: 'redirectionTest',
      title: 'Redirection',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/redirection.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Verifies that plain HTTP redirects to HTTPS, on the same host first, and records the redirect chain.',
      licence: 'MPL-2.0',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebTlsHttpsForced',
      title: 'HTTPS redirect',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L928',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsHttpsForced: Checks that http:// redirects to https:// on the same host before any other redirect.',
      licence: 'Apache-2.0',
    },
    {
      source: 'roctify',
      upstreamId: 'HTTP to HTTPS redirect',
      title: 'HTTP to HTTPS redirect (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that plain HTTP redirects to HTTPS.',
      licence: 'unlicensed site content',
    },
  ],
  'referrer-policy': [
    {
      source: 'observatory',
      upstreamId: 'referrerPolicyTest',
      title: 'Referrer Policy',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/referrer-policy.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks the Referrer-Policy header (or meta tag) and flags values that leak the full URL to other origins.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'Referrer-Policy',
      title: 'Referrer-Policy (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the Referrer-Policy header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
    {
      source: 'webbkoll',
      upstreamId: '_referrers.html.heex',
      title: 'Referrers',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll_web/templates/site/_referrers.html.heex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Reports the Referrer-Policy in use from header, meta referrer or http-equiv, and whether it limits leaks.',
      licence: 'MIT',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebAppsecprivHttpReferrerPolicy',
      title: 'Referrer Policy',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2568',
      docsUrl: 'https://internet.nl/faqs/appsecpriv/',
      summary:
        'Internet.nl subtest WebAppsecprivHttpReferrerPolicy: Checks that the site sends a Referrer-Policy that stops the full address leaking to other sites.',
      licence: 'Apache-2.0',
    },
  ],
  'robots-txt': [
    {
      source: 'files',
      upstreamId: 'robots.txt',
      title: 'robots.txt validator',
      url: 'https://llmstxtvalidator.dev',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9309',
      summary:
        'Validates robots.txt syntax and directives per the Robots Exclusion Protocol.',
      licence: 'IETF',
    },
    {
      source: 'roctify',
      upstreamId: 'robots.txt',
      title: 'robots.txt (Indexing)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that a valid robots.txt is served.',
      licence: 'unlicensed site content',
    },
  ],
  'rpki-ns-exists': [
    {
      source: 'internetnl',
      upstreamId: 'NsRpkiExists',
      title: 'Name server RPKI existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L407',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest NsRpkiExists: Requires an RPKI ROA to be published for every IP address of the name servers.',
      licence: 'Apache-2.0',
    },
  ],
  'rpki-ns-valid': [
    {
      source: 'internetnl',
      upstreamId: 'NsRpkiValid',
      title: 'Name server RPKI validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L417',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest NsRpkiValid: Requires the route announcements of the name server IP addresses to be RPKI valid.',
      licence: 'Apache-2.0',
    },
  ],
  'rpki-web-exists': [
    {
      source: 'internetnl',
      upstreamId: 'WebRpkiExists',
      title: 'Web server RPKI existence',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L318',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest WebRpkiExists: Requires an RPKI ROA to be published for every IP address of the web server.',
      licence: 'Apache-2.0',
    },
  ],
  'rpki-web-valid': [
    {
      source: 'internetnl',
      upstreamId: 'WebRpkiValid',
      title: 'Web server RPKI validity',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L389',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest WebRpkiValid: Requires the route announcements of the web server IP addresses to be RPKI valid.',
      licence: 'Apache-2.0',
    },
  ],
  'security-txt': [
    {
      source: 'files',
      upstreamId: 'security.txt',
      title: 'security.txt validator',
      url: 'https://llmstxtvalidator.dev',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc9116',
      summary:
        'Validates security.txt fields such as Contact and Expires per RFC 9116.',
      licence: 'IETF',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebAppsecprivSecuritytxt',
      title: 'security.txt',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2598',
      docsUrl: 'https://internet.nl/faqs/appsecpriv/',
      summary:
        'Internet.nl subtest WebAppsecprivSecuritytxt: Checks that the site publishes a valid security.txt with contact details for reporting vulnerabilities.',
      licence: 'Apache-2.0',
    },
  ],
  'seo-canonical-mismatch': [
    {
      source: 'opengraph',
      upstreamId: 'canonical-url-mismatch',
      title: 'Canonical URL Differs from Page URL [Info / SEO]',
      url: 'https://www.opengraph.to/articles/canonical-url-mismatch',
      docsUrl: '',
      summary:
        'Notes the canonical URL points somewhere other than the page URL and asks whether that is intended.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Canonical tag',
      title: 'Canonical tag (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page declares a canonical URL.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-canonical-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-canonical-url',
      title: 'Missing Canonical URL [Info / SEO]',
      url: 'https://www.opengraph.to/articles/missing-canonical-url',
      docsUrl: '',
      summary:
        'Notes that no canonical link is declared to prevent duplicate content.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Canonical tag',
      title: 'Canonical tag (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page declares a canonical URL.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-h1-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-h1',
      title: 'Missing H1 Heading [Warning / SEO]',
      url: 'https://www.opengraph.to/articles/missing-h1',
      docsUrl: '',
      summary: 'Warns that the page has no h1 main heading.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'H1 heading',
      title: 'H1 heading (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has exactly one h1 heading.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-h1-multiple': [
    {
      source: 'opengraph',
      upstreamId: 'multiple-h1',
      title: 'Multiple H1 Tags Found [Info / SEO]',
      url: 'https://www.opengraph.to/articles/multiple-h1',
      docsUrl: '',
      summary:
        'Notes that several h1 elements dilute the heading structure; one per page is advised.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'H1 heading',
      title: 'H1 heading (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has exactly one h1 heading.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-html-lang-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-html-lang',
      title: 'Missing lang Attribute on <html> [Warning / SEO]',
      url: 'https://www.opengraph.to/articles/missing-html-lang',
      docsUrl: '',
      summary: 'Warns that the html element has no lang attribute.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Language attribute',
      title: 'Language attribute (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the html element declares a language.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-meta-description-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-meta-description',
      title: 'Missing Meta Description [Error / SEO]',
      url: 'https://www.opengraph.to/articles/missing-meta-description',
      docsUrl: '',
      summary: 'Flags a missing meta description used for search snippets.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Meta description',
      title: 'Meta description (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has a meta description of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-meta-description-too-long': [
    {
      source: 'opengraph',
      upstreamId: 'meta-description-long',
      title: 'Meta Description Too Long [Info / SEO]',
      url: 'https://www.opengraph.to/articles/meta-description-long',
      docsUrl: '',
      summary:
        'Notes descriptions longer than the 150 to 160 characters search results usually show.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Meta description',
      title: 'Meta description (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has a meta description of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-meta-description-too-short': [
    {
      source: 'opengraph',
      upstreamId: 'meta-description-short',
      title: 'Meta Description Too Short [Info / SEO]',
      url: 'https://www.opengraph.to/articles/meta-description-short',
      docsUrl: '',
      summary:
        'Notes meta descriptions too brief to make a compelling snippet.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Meta description',
      title: 'Meta description (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page has a meta description of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-robots-nofollow': [
    {
      source: 'opengraph',
      upstreamId: 'robots-nofollow',
      title: 'Page Has nofollow Directive [Info / SEO]',
      url: 'https://www.opengraph.to/articles/robots-nofollow',
      docsUrl: '',
      summary:
        'Notes that a robots meta nofollow stops links passing SEO value.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-robots-noindex': [
    {
      source: 'opengraph',
      upstreamId: 'robots-noindex',
      title: 'Page Is Set to noindex [Warning / SEO]',
      url: 'https://www.opengraph.to/articles/robots-noindex',
      docsUrl: '',
      summary:
        'Warns that a robots meta noindex stops search engines indexing the page.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Indexability',
      title: 'Indexability (Indexing)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page is not blocked from the index.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-structured-data-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-structured-data',
      title: 'No Structured Data (JSON-LD) Found [Info / SEO]',
      url: 'https://www.opengraph.to/articles/missing-structured-data',
      docsUrl: '',
      summary:
        'Notes that no JSON-LD structured data was found for rich results.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Structured data',
      title: 'Structured data (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page carries structured data.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-title-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-html-title',
      title: 'Missing <title> Tag [Error / SEO]',
      url: 'https://www.opengraph.to/articles/missing-html-title',
      docsUrl: '',
      summary:
        'Flags a page with no HTML title element, the key on-page SEO element.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Title tag',
      title: 'Title tag (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has a title tag of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-title-too-long': [
    {
      source: 'opengraph',
      upstreamId: 'html-title-too-long',
      title: 'HTML Title Too Long [Warning / SEO]',
      url: 'https://www.opengraph.to/articles/html-title-too-long',
      docsUrl: '',
      summary:
        'Warns when the title exceeds what search results typically display (about 50 to 60 characters).',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Title tag',
      title: 'Title tag (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has a title tag of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-title-too-short': [
    {
      source: 'opengraph',
      upstreamId: 'html-title-too-short',
      title: 'HTML Title Too Short [Info / SEO]',
      url: 'https://www.opengraph.to/articles/html-title-too-short',
      docsUrl: '',
      summary: 'Notes titles too short to carry useful keywords.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Title tag',
      title: 'Title tag (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has a title tag of a sensible length.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-canonical-invalid': [
    {
      source: 'llmscout',
      upstreamId: 'canonical',
      title: 'Canonical URL',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/canonical.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Validates the canonical link href.',
      licence: 'MIT',
    },
  ],
  'technical-heading-hierarchy': [
    {
      source: 'llmscout',
      upstreamId: 'heading-structure',
      title: 'Heading structure',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/heading-structure.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Warns on skipped heading levels.',
      licence: 'MIT',
    },
    {
      source: 'roctify',
      upstreamId: 'Heading structure',
      title: 'Heading structure (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that heading levels follow on from each other.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-image-alt-coverage': [
    {
      source: 'llmscout',
      upstreamId: 'image-alt',
      title: 'Image alt text',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/image-alt.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Measures the share of img elements with alt attributes.',
      licence: 'MIT',
    },
    {
      source: 'roctify',
      upstreamId: 'Image alt text',
      title: 'Image alt text (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that images carry alt text.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-image-weight': [
    {
      source: 'llmscout',
      upstreamId: 'image-weight',
      title: 'Image weight',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/image-weight.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Warns above 200 KB and errors above 500 KB per image.',
      licence: 'MIT',
    },
  ],
  'technical-redirect-chain': [
    {
      source: 'llmscout',
      upstreamId: 'redirect-chain',
      title: 'Redirect chain',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/redirect-chain.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Flags long redirect chains and chains ending in an error.',
      licence: 'MIT',
    },
  ],
  'technical-robots-meta-advanced': [
    {
      source: 'llmscout',
      upstreamId: 'robots-meta-directives',
      title: 'Robots meta directives',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/robots-meta-directives.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary:
        'Warns when max-snippet, max-image-preview or max-video-preview are missing.',
      licence: 'MIT',
    },
  ],
  'technical-twitter-card-type': [
    {
      source: 'llmscout',
      upstreamId: 'twitter-card',
      title: 'Twitter card',
      url: 'https://github.com/RudrenduPaul/LLMScout/blob/1065c55aac42f1a3ca1c753eb9a663929965f209/src/checks/technical/twitter-card.ts',
      docsUrl:
        'https://github.com/RudrenduPaul/LLMScout/blob/main/docs/concepts.md',
      summary: 'Validates twitter:card is a known type.',
      licence: 'MIT',
    },
  ],
  'tls-cipher-order': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCipherOrder',
      title: 'Cipher suite order',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1076',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCipherOrder: Requires the HTTPS server to enforce its own preference for the most secure cipher suites.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-ciphers': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCiphers',
      title: 'Cipher suites',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1047',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCiphers: Requires the HTTPS server to accept only secure (good or sufficient) cipher suites.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-compression': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsCompression',
      title: 'TLS compression',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1134',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsCompression: Requires the HTTPS server not to support TLS compression.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-ems': [
    {
      source: 'internetnl',
      upstreamId: 'WebTLSExtendedMasterSecret',
      title: 'Extended Master Secret (EMS)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1543',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTLSExtendedMasterSecret: Requires the HTTPS server to support the TLS 1.2 Extended Master Secret (RFC 7627).',
      licence: 'Apache-2.0',
    },
  ],
  'tls-kex-hash': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsKexHashFunc',
      title: 'Hash function for key exchange',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1503',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsKexHashFunc: Requires the HTTPS server not to sign the TLS key exchange with weak hash functions (SHA-1, SHA-224).',
      licence: 'Apache-2.0',
    },
  ],
  'tls-kex-params': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsFsParams',
      title: 'Parameters for key exchange',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1013',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsFsParams: Requires the ephemeral Diffie-Hellman parameters of the HTTPS server (DH size, EC curves) to be secure.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-ocsp-stapling': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsOCSPStapling',
      title: 'OCSP stapling',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1470',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsOCSPStapling: Checks that the HTTPS server staples an OCSP response when its certificate has an OCSP pointer.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-renegotiation-client': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsRenegotiationClient',
      title: 'Client-initiated renegotiation',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1180',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsRenegotiationClient: Checks that the HTTPS server does not allow unlimited client-initiated renegotiation.',
      licence: 'Apache-2.0',
    },
  ],
  'tls-renegotiation-secure': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsRenegotiationSecure',
      title: 'Secure renegotiation',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1157',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsRenegotiationSecure: Requires the HTTPS server to support secure renegotiation (RFC 5746).',
      licence: 'Apache-2.0',
    },
  ],
  'tls-version': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsVersion',
      title: 'TLS version',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1105',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsVersion: Requires the HTTPS server to accept only secure TLS versions (TLS 1.3 and TLS 1.2).',
      licence: 'Apache-2.0',
    },
  ],
  'tls-zero-rtt': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsZeroRTT',
      title: '0-RTT',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1442',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsZeroRTT: Requires the HTTPS server not to accept TLS 1.3 0-RTT early data.',
      licence: 'Apache-2.0',
    },
  ],
  'twitter-card-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-twitter-card',
      title: 'Missing twitter:card [Warning / Twitter]',
      url: 'https://www.opengraph.to/articles/missing-twitter-card',
      docsUrl: '',
      summary:
        'Warns that twitter:card is absent so X/Twitter shows only a basic link.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'X (Twitter) card',
      title: 'X (Twitter) card (Social media)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has an X card tag.',
      licence: 'unlicensed site content',
    },
  ],
  'twitter-card-not-large': [
    {
      source: 'opengraph',
      upstreamId: 'twitter-card-not-large',
      title: 'Twitter Card Is "summary" [Info / Twitter]',
      url: 'https://www.opengraph.to/articles/twitter-card-not-large',
      docsUrl: '',
      summary:
        'Suggests summary_large_image instead of the plain summary card for a bigger preview.',
      licence: 'unlicensed site content',
    },
  ],
  'twitter-description-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-twitter-description',
      title: 'Missing twitter:description [Warning / Twitter]',
      url: 'https://www.opengraph.to/articles/missing-twitter-description',
      docsUrl: '',
      summary: 'Warns that a dedicated twitter:description is not set.',
      licence: 'unlicensed site content',
    },
  ],
  'twitter-image-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-twitter-image',
      title: 'Missing twitter:image [Warning / Twitter]',
      url: 'https://www.opengraph.to/articles/missing-twitter-image',
      docsUrl: '',
      summary:
        'Warns that twitter:image is absent, reducing engagement on X/Twitter.',
      licence: 'unlicensed site content',
    },
  ],
  'twitter-site-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-twitter-site',
      title: 'Missing twitter:site [Info / Twitter]',
      url: 'https://www.opengraph.to/articles/missing-twitter-site',
      docsUrl: '',
      summary:
        'Notes that twitter:site, attributing content to an account, is absent.',
      licence: 'unlicensed site content',
    },
  ],
  'twitter-title-missing': [
    {
      source: 'opengraph',
      upstreamId: 'missing-twitter-title',
      title: 'Missing twitter:title [Warning / Twitter]',
      url: 'https://www.opengraph.to/articles/missing-twitter-title',
      docsUrl: '',
      summary: 'Warns that a dedicated twitter:title is not set.',
      licence: 'unlicensed site content',
    },
  ],
  'x-dns-prefetch-control': [
    {
      source: 'owasp',
      upstreamId: 'X-DNS-Prefetch-Control',
      title: 'X-DNS-Prefetch-Control (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary: 'Expects X-DNS-Prefetch-Control to be off.',
      licence: 'Apache-2.0',
    },
  ],
  'x-frame-options': [
    {
      source: 'observatory',
      upstreamId: 'xFrameOptionsTest',
      title: 'X-Frame-Options',
      url: 'https://github.com/mdn/mdn-http-observatory/blob/7a015bd126925fe217ecb33f92e1c4b1d764ff13/src/analyzer/tests/x-frame-options.js',
      docsUrl:
        'https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring',
      summary:
        'Checks that framing is blocked via X-Frame-Options or CSP frame-ancestors.',
      licence: 'MPL-2.0',
    },
    {
      source: 'owasp',
      upstreamId: 'X-Frame-Options',
      title: 'X-Frame-Options (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'OSHP recommended value for the X-Frame-Options header, as encoded in the validator test suite.',
      licence: 'Apache-2.0',
    },
    {
      source: 'webbkoll',
      upstreamId: 'x_frame_options/2',
      title: 'X-Frame-Options',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/header_analysis.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary: 'Checks X-Frame-Options, falling back to CSP frame-ancestors.',
      licence: 'MIT',
    },
    {
      source: 'internetnl',
      upstreamId: 'WebAppsecprivHttpXFrame',
      title: 'X-Frame-Options',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2497',
      docsUrl: 'https://internet.nl/faqs/appsecpriv/',
      summary:
        'Internet.nl subtest WebAppsecprivHttpXFrame: Checks that the page cannot be framed by other sites, with X-Frame-Options or CSP frame-ancestors.',
      licence: 'Apache-2.0',
    },
    {
      source: 'roctify',
      upstreamId: 'Clickjacking protection',
      title: 'Clickjacking protection (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that framing is restricted.',
      licence: 'unlicensed site content',
    },
  ],
  'x-permitted-cross-domain-policies': [
    {
      source: 'owasp',
      upstreamId: 'X-Permitted-Cross-Domain-Policies',
      title: 'X-Permitted-Cross-Domain-Policies (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary: 'Expects X-Permitted-Cross-Domain-Policies to be none.',
      licence: 'Apache-2.0',
    },
  ],
  'x-xss-protection': [
    {
      source: 'owasp',
      upstreamId: 'X-XSS-Protection',
      title: 'X-XSS-Protection (OSHP validator test suite)',
      url: 'https://github.com/OWASP/secure-headers-project/blob/bf9ebd290f87ce48a8c31faa2e247370bf7b37b2/subprojects/validator/tests_suite.yml',
      docsUrl: 'https://owasp.org/www-project-secure-headers/',
      summary:
        'Flags the obsolete X-XSS-Protection header, which should not be sent.',
      licence: 'Apache-2.0',
    },
    {
      source: 'webbkoll',
      upstreamId: 'x_xss_protection/2',
      title: 'X-XSS-Protection',
      url: 'https://codeberg.org/dataskydd.net/webbkoll/src/commit/b2d40cca947e4eac790c969784775c0466061507/lib/webbkoll/header_analysis.ex',
      docsUrl: 'https://webbkoll.dataskydd.net/en/about',
      summary:
        'Evaluates the X-XSS-Protection header, taking CSP into account.',
      licence: 'MIT',
    },
  ],
  'mail-tls-version': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsVersion',
      title: 'TLS version (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1772',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsVersion: Requires every mail server (MX) to accept only TLS 1.3 and TLS 1.2 over STARTTLS, probing each version separately.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-ciphers': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCiphers',
      title: 'Cipher suites (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1702',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCiphers: Requires every mail server (MX) to accept only good or sufficient cipher suites, found by offering all suites and removing the one chosen until none is left.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-cipher-order': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCipherOrder',
      title: 'Cipher suite order (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1737',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCipherOrder: Requires every mail server (MX) to apply its own cipher preference and rank the secure suites above the phase out ones.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-kex-params': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsFsParams',
      title: 'Key exchange parameters (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1661',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsFsParams: Rates the Diffie-Hellman group sizes and elliptic curves that every mail server (MX) accepts for key exchange.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-kex-hash': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsKexHashFunc',
      title: 'Key exchange hash function (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2151',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsKexHashFunc: Flags mail servers (MX) that sign the key exchange with SHA-1 (insufficient) or SHA-224 (phase out).',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-ocsp-stapling': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsOCSPStapling',
      title: 'OCSP stapling (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2112',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsOCSPStapling: Reports mail servers (MX) whose certificate names an OCSP responder but that do not staple a response; information only.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-cert-trust': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCertTrust',
      title: 'Trust chain of certificate (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1902',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCertTrust: Checks that the certificate chain of every mail server (MX) is complete and ends in a publicly trusted root; information only for mail.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-cert-pubkey': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCertPubkey',
      title: 'Public key of certificate (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1933',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCertPubkey: Rates the public key type and size of every certificate in the chain of each mail server (MX).',
      licence: 'Apache-2.0',
    },
  ],
  'mail-cert-signature': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCertSignature',
      title: 'Signature of certificate (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1967',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCertSignature: Rates the signature algorithm and hash function of every certificate in the chain of each mail server (MX).',
      licence: 'Apache-2.0',
    },
  ],
  'mail-cert-hostname': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCertHostmatch',
      title: 'Domain name on certificate (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2002',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCertHostmatch: Checks that the name of each mail server (MX) appears on its certificate; information only unless a DANE-TA record is published.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-caa': [
    {
      source: 'internetnl',
      upstreamId: 'MailCaa',
      title: 'CAA for mail server',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2038',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailCaa: Looks up the CAA records that cover each mail server (MX) name and flags missing, malformed or issue-less policies as notices.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-compression': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsCompression',
      title: 'TLS compression (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1807',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsCompression: Fails mail servers (MX) that negotiate TLS compression, tested with an STARTTLS handshake that offers it.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-renegotiation-secure': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsRenegotiationSecure',
      title: 'Secure renegotiation (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1835',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsRenegotiationSecure: Fails mail servers (MX) that do not support the RFC 5746 secure renegotiation extension.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-renegotiation-client': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsRenegotiationClient',
      title: 'Client-initiated renegotiation (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1863',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsRenegotiationClient: Reports mail servers (MX) that let a client renegotiate more often than the allowed limit; information only.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-zero-rtt': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsZeroRTT',
      title: '0-RTT (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2078',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsZeroRTT: Fails mail servers (MX) that accept TLS 1.3 early data when a session is resumed.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-tls-ems': [
    {
      source: 'internetnl',
      upstreamId: 'MailTLSExtendedMasterSecret',
      title: 'Extended Master Secret (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2191',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTLSExtendedMasterSecret: Reports mail servers (MX) that do not use the TLS 1.2 Extended Master Secret.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-dane-rollover': [
    {
      source: 'internetnl',
      upstreamId: 'MailTlsDaneRollover',
      title: 'DANE rollover scheme (mail)',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L2302',
      docsUrl: 'https://internet.nl/faqs/starttls/',
      summary:
        'Internet.nl subtest MailTlsDaneRollover: Checks that a mail server (MX) with DANE publishes two usable TLSA records, so a certificate can be replaced without breaking DANE.',
      licence: 'Apache-2.0',
    },
  ],
  'dane-rollover': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsDaneRollover',
      title: 'DANE rollover scheme',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L1416',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsDaneRollover: Checks that a website with DANE publishes two usable TLSA records so a certificate can be replaced without breaking DANE; upstream the test is currently disabled.',
      licence: 'Apache-2.0',
    },
  ],
  'mail-ns-rpki-exists': [
    {
      source: 'internetnl',
      upstreamId: 'MailMxNsRpkiExists',
      title: 'RPKI existence for mail server name servers',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L427',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest MailMxNsRpkiExists: Requires a published ROA for every IP address of the name servers of each mail server (MX).',
      licence: 'Apache-2.0',
    },
  ],
  'mail-ns-rpki-valid': [
    {
      source: 'internetnl',
      upstreamId: 'MailMxNsRpkiValid',
      title: 'RPKI validity for mail server name servers',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L437',
      docsUrl: 'https://internet.nl/faqs/rpki/',
      summary:
        'Internet.nl subtest MailMxNsRpkiValid: Requires the route announcement of every IP address of the name servers of each mail server (MX) to be RPKI valid.',
      licence: 'Apache-2.0',
    },
  ],
  'https-available': [
    {
      source: 'internetnl',
      upstreamId: 'WebTlsHttpsExists',
      title: 'HTTPS available',
      url: 'https://github.com/internetstandards/Internet.nl/blob/ad507d18bee333f3db5a3a3cf965678a41b5893a/checks/categories.py#L902',
      docsUrl: 'https://internet.nl/faqs/https/',
      summary:
        'Internet.nl subtest WebTlsHttpsExists: Checks that the website completes a TLS handshake on the HTTPS port.',
      licence: 'Apache-2.0',
    },
    {
      source: 'roctify',
      upstreamId: 'HTTPS',
      title: 'HTTPS (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the site is served over HTTPS.',
      licence: 'unlicensed site content',
    },
  ],
  'server-banner': [
    {
      source: 'mdn',
      upstreamId: 'Server',
      title: 'Server',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server',
      docsUrl: '',
      summary:
        'Reports when the Server header discloses a software version or operating system.',
      licence: 'CC-BY-SA-2.5',
    },
    {
      source: 'roctify',
      upstreamId: 'Server signature',
      title: 'Server signature (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the Server header does not reveal the software version.',
      licence: 'unlicensed site content',
    },
  ],
  'x-powered-by': [
    {
      source: 'mdn',
      upstreamId: 'X-Powered-By',
      title: 'X-Powered-By',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Powered-By',
      docsUrl: '',
      summary:
        'Reports the X-Powered-By header, which reveals the technology stack.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'server-timing': [
    {
      source: 'mdn',
      upstreamId: 'Server-Timing',
      title: 'Server-Timing',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing',
      docsUrl: '',
      summary:
        'Reports the Server-Timing header, which can expose backend metric names and timings.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  via: [
    {
      source: 'mdn',
      upstreamId: 'Via',
      title: 'Via',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Via',
      docsUrl: '',
      summary:
        'Reports when the Via header names the proxy or gateway software in front of the site.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  sourcemap: [
    {
      source: 'mdn',
      upstreamId: 'SourceMap',
      title: 'SourceMap',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/SourceMap',
      docsUrl: '',
      summary:
        'Reports the SourceMap or X-SourceMap header, which exposes source maps to every client.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'cors-allow-credentials': [
    {
      source: 'mdn',
      upstreamId: 'Access-Control-Allow-Credentials',
      title: 'Access-Control-Allow-Credentials',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials',
      docsUrl: '',
      summary:
        'Reports credentialed CORS access, especially when combined with a wildcard allow-origin.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'cors-allow-methods': [
    {
      source: 'mdn',
      upstreamId: 'Access-Control-Allow-Methods',
      title: 'Access-Control-Allow-Methods',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Methods',
      docsUrl: '',
      summary:
        'Reports a wildcard or unrecognised method in Access-Control-Allow-Methods.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'cors-allow-headers': [
    {
      source: 'mdn',
      upstreamId: 'Access-Control-Allow-Headers',
      title: 'Access-Control-Allow-Headers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Headers',
      docsUrl: '',
      summary:
        'Reports a wildcard Access-Control-Allow-Headers that allows every request header.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'cors-expose-headers': [
    {
      source: 'mdn',
      upstreamId: 'Access-Control-Expose-Headers',
      title: 'Access-Control-Expose-Headers',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers',
      docsUrl: '',
      summary:
        'Reports a wildcard or sensitive header in Access-Control-Expose-Headers.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'cors-max-age': [
    {
      source: 'mdn',
      upstreamId: 'Access-Control-Max-Age',
      title: 'Access-Control-Max-Age',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age',
      docsUrl: '',
      summary:
        'Reports a malformed or excessively long Access-Control-Max-Age preflight cache.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'reporting-endpoints': [
    {
      source: 'mdn',
      upstreamId: 'Reporting-Endpoints',
      title: 'Reporting-Endpoints',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints',
      docsUrl: '',
      summary:
        'Checks that Reporting-Endpoints maps names to quoted absolute https URLs.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  nel: [
    {
      source: 'mdn',
      upstreamId: 'NEL',
      title: 'NEL',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/NEL',
      docsUrl: '',
      summary:
        'Checks that the NEL header is valid JSON with a max_age and a report_to group.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'origin-agent-cluster': [
    {
      source: 'mdn',
      upstreamId: 'Origin-Agent-Cluster',
      title: 'Origin-Agent-Cluster',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin-Agent-Cluster',
      docsUrl: '',
      summary:
        'Recommends Origin-Agent-Cluster: ?1 and reports any other value.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'integrity-policy': [
    {
      source: 'mdn',
      upstreamId: 'Integrity-Policy',
      title: 'Integrity-Policy',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Integrity-Policy',
      docsUrl: '',
      summary:
        'Checks that Integrity-Policy declares a non-empty blocked-destinations list.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'integrity-policy-report-only': [
    {
      source: 'mdn',
      upstreamId: 'Integrity-Policy-Report-Only',
      title: 'Integrity-Policy-Report-Only',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Integrity-Policy-Report-Only',
      docsUrl: '',
      summary:
        'Checks that Integrity-Policy-Report-Only declares a non-empty blocked-destinations list.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  etag: [
    {
      source: 'mdn',
      upstreamId: 'ETag',
      title: 'ETag',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
      docsUrl: '',
      summary:
        'Reports an ETag that looks like a filesystem inode and so leaks server internals.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'last-modified': [
    {
      source: 'mdn',
      upstreamId: 'Last-Modified',
      title: 'Last-Modified',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Last-Modified',
      docsUrl: '',
      summary: 'Checks that the Last-Modified header is a valid HTTP-date.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  expires: [
    {
      source: 'mdn',
      upstreamId: 'Expires',
      title: 'Expires',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires',
      docsUrl: '',
      summary:
        'Checks that Expires is a valid HTTP-date and notes when Cache-Control max-age supersedes it.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  age: [
    {
      source: 'mdn',
      upstreamId: 'Age',
      title: 'Age',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Age',
      docsUrl: '',
      summary:
        'Checks that the Age header is a non-negative number of seconds.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  vary: [
    {
      source: 'mdn',
      upstreamId: 'Vary',
      title: 'Vary',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
      docsUrl: '',
      summary:
        'Reports Vary: * and a wildcard mixed with named headers, which defeat shared caching.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'no-vary-search': [
    {
      source: 'mdn',
      upstreamId: 'No-Vary-Search',
      title: 'No-Vary-Search',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search',
      docsUrl: '',
      summary:
        'Checks that No-Vary-Search uses the recognised key-order, params or except keys.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'accept-ch': [
    {
      source: 'mdn',
      upstreamId: 'Accept-CH',
      title: 'Accept-CH',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-CH',
      docsUrl: '',
      summary:
        'Checks the Accept-CH token list and notes that each client hint adds to fingerprinting.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'critical-ch': [
    {
      source: 'mdn',
      upstreamId: 'Critical-CH',
      title: 'Critical-CH',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Critical-CH',
      docsUrl: '',
      summary:
        'Checks that every hint in Critical-CH is also advertised in Accept-CH.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'timing-allow-origin': [
    {
      source: 'mdn',
      upstreamId: 'Timing-Allow-Origin',
      title: 'Timing-Allow-Origin',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Timing-Allow-Origin',
      docsUrl: '',
      summary:
        'Reports Timing-Allow-Origin: * and malformed origins in the timing-exposure list.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'alt-svc': [
    {
      source: 'mdn',
      upstreamId: 'Alt-Svc',
      title: 'Alt-Svc',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Alt-Svc',
      docsUrl: '',
      summary:
        'Reports the advertised alternative services and flags a malformed Alt-Svc value.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'retry-after': [
    {
      source: 'mdn',
      upstreamId: 'Retry-After',
      title: 'Retry-After',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After',
      docsUrl: '',
      summary:
        'Checks that Retry-After is a valid delay on a 429 or 503 response.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  // wellknown set.
  'ads-txt': [
    {
      source: 'iab',
      upstreamId: 'ads.txt 1.1',
      title: 'Authorized Digital Sellers (ads.txt)',
      url: 'https://iabtechlab.com/ads-txt/',
      docsUrl:
        'https://iabtechlab.com/wp-content/uploads/2022/04/Ads.txt-1.1.pdf',
      summary:
        'Validates /ads.txt as a line-based list of authorised sellers: data records of domain, publisher id and DIRECT or RESELLER, plus the CONTACT, SUBDOMAIN, OWNERDOMAIN and MANAGERDOMAIN variables.',
      licence: 'unlicensed site content',
    },
  ],
  'app-ads-txt': [
    {
      source: 'iab',
      upstreamId: 'app-ads.txt 1.0',
      title: 'Authorized Sellers for Apps (app-ads.txt)',
      url: 'https://iabtechlab.com/ads-txt/',
      docsUrl:
        'https://iabtechlab.com/wp-content/uploads/2020/05/app-ads.txt-v1.0-final-.pdf',
      summary:
        'Validates /app-ads.txt, the mobile-app and CTV addendum to ads.txt, against the same record and variable grammar.',
      licence: 'unlicensed site content',
    },
  ],
  'sellers-json': [
    {
      source: 'iab',
      upstreamId: 'sellers.json 1.0',
      title: 'sellers.json',
      url: 'https://iabtechlab.com/sellers-json/',
      docsUrl:
        'https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json_Final.pdf',
      summary:
        'Validates /sellers.json as JSON with a version and a sellers array; each seller needs a seller_id and a PUBLISHER, INTERMEDIARY or BOTH seller_type, with name and domain unless confidential.',
      licence: 'unlicensed site content',
    },
  ],
  'humans-txt': [
    {
      source: 'indieweb',
      upstreamId: 'humans.txt',
      title: 'We are people, not machines (humans.txt)',
      url: 'https://humanstxt.org/',
      docsUrl: 'https://humanstxt.org/Standard.html',
      summary:
        'Checks that /humans.txt exists at the web root and is served as plain text; informational only.',
      licence: 'unlicensed site content',
    },
  ],
  'change-password': [
    {
      source: 'w3c',
      upstreamId: 'well-known-change-password',
      title: 'A Well-Known URL for Changing Passwords',
      url: 'https://w3c.github.io/webappsec-change-password-url/',
      docsUrl: 'https://w3c.github.io/webappsec-change-password-url/',
      summary:
        'Checks that /.well-known/change-password resolves (a 200 or a redirect to a password-change page) rather than returning a client or server error.',
      licence: 'W3C Document License',
    },
  ],
  'apple-app-site-association': [
    {
      source: 'apple',
      upstreamId: 'apple-app-site-association',
      title: 'Supporting associated domains',
      url: 'https://developer.apple.com/documentation/xcode/supporting-associated-domains',
      docsUrl:
        'https://developer.apple.com/documentation/xcode/supporting-associated-domains',
      summary:
        'Validates the apple-app-site-association file (application/json, no .json extension) and its applinks, webcredentials and appclips services.',
      licence: 'unlicensed site content',
    },
  ],
  'assetlinks-json': [
    {
      source: 'google',
      upstreamId: 'digital-asset-links-v1',
      title: 'Digital Asset Links',
      url: 'https://developers.google.com/digital-asset-links/v1/getting-started',
      docsUrl:
        'https://developers.google.com/digital-asset-links/v1/statements',
      summary:
        'Validates /.well-known/assetlinks.json as an array of statements, each with a relation array and an android_app or web target.',
      licence: 'unlicensed site content',
    },
  ],
  'gpc-json': [
    {
      source: 'w3c',
      upstreamId: 'gpc-spec-well-known',
      title: 'Global Privacy Control (GPC)',
      url: 'https://privacycg.github.io/gpc-spec/',
      docsUrl: 'https://privacycg.github.io/gpc-spec/#the-well-known-resource',
      summary:
        'Validates /.well-known/gpc.json as an object with a boolean gpc field and an ISO 8601 lastUpdate date.',
      licence: 'W3C Document License',
    },
  ],
  // i18n set.
  'hreflang-return': [
    {
      source: 'google',
      upstreamId: 'hreflang return tags',
      title: 'hreflang return tags',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      docsUrl:
        'https://developers.google.com/search/docs/specialty/international/localized-versions',
      summary:
        'Checks that each hreflang alternate uses a fully-qualified URL so reciprocal return links resolve.',
      licence: 'unlicensed site content',
    },
  ],
  'hreflang-x-default': [
    {
      source: 'google',
      upstreamId: 'hreflang x-default',
      title: 'hreflang x-default',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      docsUrl:
        'https://developers.google.com/search/docs/specialty/international/localized-versions',
      summary: 'Checks that an hreflang set includes an x-default entry.',
      licence: 'unlicensed site content',
    },
  ],
  'hreflang-valid-codes': [
    {
      source: 'google',
      upstreamId: 'hreflang language/region codes',
      title: 'hreflang language/region codes',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      docsUrl:
        'https://developers.google.com/search/docs/specialty/international/localized-versions',
      summary:
        'Checks that each hreflang value is x-default or a valid ISO 639-1 language with an optional ISO 3166-1 region.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Hreflang',
      title: 'Hreflang (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks the hreflang alternates of the page.',
      licence: 'unlicensed site content',
    },
  ],
  'hreflang-self': [
    {
      source: 'google',
      upstreamId: 'hreflang self-reference',
      title: 'hreflang self-reference',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      docsUrl:
        'https://developers.google.com/search/docs/specialty/international/localized-versions',
      summary: 'Checks that an hreflang set references the page itself.',
      licence: 'unlicensed site content',
    },
    {
      source: 'roctify',
      upstreamId: 'Hreflang',
      title: 'Hreflang (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks the hreflang alternates of the page.',
      licence: 'unlicensed site content',
    },
  ],
  'hreflang-duplicate': [
    {
      source: 'google',
      upstreamId: 'hreflang duplicates',
      title: 'hreflang duplicates',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
      docsUrl:
        'https://developers.google.com/search/docs/specialty/international/localized-versions',
      summary:
        'Checks that no hreflang value is declared on more than one alternate.',
      licence: 'unlicensed site content',
    },
  ],
  'alternate-media': [
    {
      source: 'mdn',
      upstreamId: 'rel=alternate media',
      title: 'rel=alternate media',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
      docsUrl:
        'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
      summary:
        'Checks that a rel="alternate" media link has a non-empty media query and an absolute href.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'pagination-rel': [
    {
      source: 'mdn',
      upstreamId: 'rel=prev and rel=next',
      title: 'rel=prev and rel=next',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
      docsUrl:
        'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
      summary:
        'Checks that rel="prev"/rel="next" links use well-formed absolute URLs.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  // emailpolicy set.
  'mta-sts': [
    {
      source: 'ietf',
      upstreamId: 'RFC 8461',
      title: 'SMTP MTA Strict Transport Security (MTA-STS)',
      url: 'https://www.rfc-editor.org/rfc/rfc8461',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc8461',
      summary:
        'Checks the `_mta-sts` TXT record and the HTTPS policy file that tell sending servers mail must use authenticated TLS.',
      licence: 'IETF Trust (RFC text)',
    },
  ],
  'tls-rpt': [
    {
      source: 'ietf',
      upstreamId: 'RFC 8460',
      title: 'SMTP TLS Reporting (TLS-RPT)',
      url: 'https://www.rfc-editor.org/rfc/rfc8460',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc8460',
      summary:
        'Checks the `_smtp._tls` TXT record that asks sending servers to report TLS delivery failures.',
      licence: 'IETF Trust (RFC text)',
    },
  ],
  bimi: [
    {
      source: 'ietf',
      upstreamId: 'BIMI',
      title: 'Brand Indicators for Message Identification (BIMI)',
      url: 'https://bimigroup.org',
      docsUrl:
        'https://datatracker.ietf.org/doc/draft-brand-indicators-for-message-identification/',
      summary:
        'Checks the `default._bimi` TXT record that points mail clients at an HTTPS SVG logo and its optional verification certificate.',
      licence: 'unlicensed site content, IETF draft',
    },
  ],
  // richresults set.
  'richresults-recipe': [
    {
      source: 'google',
      upstreamId: 'Recipe rich results',
      title: 'Google rich results: Recipe',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/recipe',
      summary:
        "Validates Recipe JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-product': [
    {
      source: 'google',
      upstreamId: 'Product rich results',
      title: 'Google rich results: Product',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/product-snippet',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/product-snippet',
      summary:
        "Validates Product JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-article': [
    {
      source: 'google',
      upstreamId: 'Article/NewsArticle/BlogPosting rich results',
      title: 'Google rich results: Article/NewsArticle/BlogPosting',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/article',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/article',
      summary:
        "Validates Article/NewsArticle/BlogPosting JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-breadcrumb': [
    {
      source: 'google',
      upstreamId: 'BreadcrumbList rich results',
      title: 'Google rich results: BreadcrumbList',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
      summary:
        "Validates BreadcrumbList JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-event': [
    {
      source: 'google',
      upstreamId: 'Event rich results',
      title: 'Google rich results: Event',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/event',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/event',
      summary:
        "Validates Event JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-video': [
    {
      source: 'google',
      upstreamId: 'VideoObject rich results',
      title: 'Google rich results: VideoObject',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/video',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/video',
      summary:
        "Validates VideoObject JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-jobposting': [
    {
      source: 'google',
      upstreamId: 'JobPosting rich results',
      title: 'Google rich results: JobPosting',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
      summary:
        "Validates JobPosting JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-localbusiness': [
    {
      source: 'google',
      upstreamId: 'LocalBusiness rich results',
      title: 'Google rich results: LocalBusiness',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/local-business',
      summary:
        "Validates LocalBusiness JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-review': [
    {
      source: 'google',
      upstreamId: 'Review/AggregateRating rich results',
      title: 'Google rich results: Review/AggregateRating',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
      summary:
        "Validates Review/AggregateRating JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  'richresults-website-searchaction': [
    {
      source: 'google',
      upstreamId: 'WebSite SearchAction rich results',
      title: 'Google rich results: WebSite SearchAction',
      url: 'https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox',
      docsUrl:
        'https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox',
      summary:
        "Validates WebSite SearchAction JSON-LD against Google's required and recommended rich-results properties.",
      licence: 'unlicensed site content',
    },
  ],
  // feeds set.
  'feed-discovery': [
    {
      source: 'ietf',
      upstreamId: 'RSS Autodiscovery',
      title: 'RSS/Atom feed autodiscovery',
      url: 'https://www.rssboard.org/rss-autodiscovery',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc4287',
      summary:
        'Checks that a feed is advertised with <link rel="alternate" type="application/rss+xml"> or "application/atom+xml" and an absolute href.',
      licence: 'RSS Advisory Board, IETF',
    },
  ],
  'feed-valid': [
    {
      source: 'ietf',
      upstreamId: 'RSS 2.0 / RFC 4287',
      title: 'RSS 2.0 and Atom 1.0 well-formedness',
      url: 'https://www.rssboard.org/rss-specification',
      docsUrl: 'https://www.rfc-editor.org/rfc/rfc4287',
      summary:
        'Fetches each discovered feed and checks it is a well-formed RSS 2.0 (<rss>/<channel> with title, link, description) or Atom 1.0 (<feed> with id, title, updated) document.',
      licence: 'RSS Advisory Board, IETF',
    },
  ],
  'oembed-discovery': [
    {
      source: 'oembed',
      upstreamId: 'oEmbed Discovery',
      title: 'oEmbed endpoint autodiscovery',
      url: 'https://oembed.com/#section4',
      docsUrl: 'https://oembed.com',
      summary:
        'Checks that an oEmbed endpoint is advertised with <link rel="alternate" type="application/json+oembed"> or "text/xml+oembed" and an href.',
      licence: 'unlicensed site content',
    },
  ],
  'opensearch-discovery': [
    {
      source: 'opensearch',
      upstreamId: 'OpenSearch Autodiscovery',
      title: 'OpenSearch description autodiscovery',
      url: 'https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md#autodiscovery',
      docsUrl: 'https://github.com/dewitt/opensearch',
      summary:
        'Checks that an OpenSearch description is advertised with <link rel="search" type="application/opensearchdescription+xml">.',
      licence: 'unlicensed specification text',
    },
  ],
  'opensearch-valid': [
    {
      source: 'opensearch',
      upstreamId: 'OpenSearch Description Document',
      title: 'OpenSearch description well-formedness',
      url: 'https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md',
      docsUrl: 'https://github.com/dewitt/opensearch',
      summary:
        'Fetches the discovered OpenSearch description and checks it is a well-formed OpenSearchDescription with a ShortName (<=16 chars) and a Url template.',
      licence: 'unlicensed specification text',
    },
  ],
  // pwa set.
  'manifest-linked': [
    {
      source: 'w3c',
      upstreamId: 'manifest link',
      title: 'Linking a Web App Manifest',
      url: 'https://www.w3.org/TR/appmanifest/',
      docsUrl: 'https://web.dev/articles/add-manifest',
      summary:
        'A page links its Web App Manifest with <link rel="manifest">; the href should be absolute so it resolves on every route.',
      licence: 'W3C Software and Document License',
    },
  ],
  'manifest-valid': [
    {
      source: 'w3c',
      upstreamId: 'Web App Manifest members',
      title: 'Web App Manifest',
      url: 'https://www.w3.org/TR/appmanifest/',
      docsUrl: 'https://web.dev/articles/add-manifest',
      summary:
        'The fetched manifest must be valid JSON of the correct media type and carry the members the browser install criteria need.',
      licence: 'W3C Software and Document License',
    },
  ],
  'manifest-icons': [
    {
      source: 'w3c',
      upstreamId: 'icons member',
      title: 'The icons member',
      url: 'https://www.w3.org/TR/appmanifest/#icons-member',
      docsUrl: 'https://web.dev/articles/add-manifest#icons',
      summary:
        'The install criteria need a 192x192 and a 512x512 PNG icon declared in the manifest icons member.',
      licence: 'W3C Software and Document License',
    },
  ],
  'theme-color-meta': [
    {
      source: 'w3c',
      upstreamId: 'theme-color',
      title: 'Theming the browser UI',
      url: 'https://www.w3.org/TR/appmanifest/',
      docsUrl: 'https://web.dev/articles/add-manifest#theme-color',
      summary:
        'A <meta name="theme-color"> themes the browser UI as the page loads, complementing the manifest theme_color.',
      licence: 'W3C Software and Document License',
    },
  ],
  // exposure set.
  'exposed-git': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed .git directory',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-env': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed .env file',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-svn': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed .svn directory',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-ds-store': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed .DS_Store file',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-directory-listing': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed directory listing',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-backup-files': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed backup files',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-source-map': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-04',
      title: 'Exposed JavaScript source map',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-server-status': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-05',
      title: 'Exposed server-status page',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  'exposed-crossdomain': [
    {
      source: 'owasp',
      upstreamId: 'WSTG-CONF-08',
      title: 'Overly permissive crossdomain.xml',
      url: 'https://owasp.org/www-project-web-security-testing-guide/',
      docsUrl:
        'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/08-Test_RIA_Cross_Domain_Policy',
      summary:
        'Probes a specific path and reports an error only when the response body confirms the sensitive artifact, so a single-page-app catch-all 200 is not flagged.',
      licence: 'CC-BY-SA-4.0',
    },
  ],
  // secplus set.
  tabnabbing: [
    {
      source: 'owasp',
      upstreamId: 'Reverse Tabnabbing',
      title: 'Reverse Tabnabbing',
      url: 'https://owasp.org/www-community/attacks/Reverse_Tabnabbing',
      docsUrl:
        'https://developer.mozilla.org/docs/Web/HTML/Reference/Attributes/rel/noopener',
      summary:
        'Flags a cross-origin target="_blank" link without rel="noopener" or rel="noreferrer", which lets the opened page redirect the original tab.',
      licence: 'CC-BY-SA',
    },
  ],
  'csp-strength': [
    {
      source: 'google',
      upstreamId: 'CSP Evaluator',
      title: 'CSP Evaluator',
      url: 'https://csp-evaluator.withgoogle.com',
      docsUrl: 'https://web.dev/articles/strict-csp',
      summary:
        "Evaluates CSP depth: 'unsafe-inline' without a nonce or hash, 'unsafe-eval', missing object-src 'none' and base-uri, broad allowlists (*, https:), and reliance on an allowlist instead of 'strict-dynamic'.",
      licence: 'unlicensed site content',
    },
  ],
  'cookie-prefixes': [
    {
      source: 'owasp',
      upstreamId: 'Cookie prefixes',
      title: 'Cookie prefixes (__Host- / __Secure-)',
      url: 'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis',
      docsUrl:
        'https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes',
      summary:
        'Checks that a __Host- cookie is Secure, has Path=/ and no Domain, and that a __Secure- cookie is Secure, as the browser enforces for the prefix.',
      licence: 'IETF',
    },
  ],
  'http-methods': [
    {
      source: 'owasp',
      upstreamId: 'Test HTTP Methods',
      title: 'Test HTTP Methods (WSTG-CONF-06)',
      url: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods',
      docsUrl: '',
      summary:
        'Sends OPTIONS to the root and flags TRACE/TRACK (Cross-Site Tracing) and unsafe write methods (PUT, DELETE, PATCH, CONNECT).',
      licence: 'CC-BY-SA',
    },
  ],
  'form-action-secure': [
    {
      source: 'owasp',
      upstreamId: 'Insecure form submission',
      title: 'Insecure form submission (mixed form)',
      url: 'https://developer.mozilla.org/docs/Web/Security/Insecure_passwords#insecure_forms',
      docsUrl: '',
      summary:
        'Flags a form on an HTTPS page whose action resolves to an http:// URL, which submits data in clear text.',
      licence: 'CC-BY-SA',
    },
  ],
  // headersx set.
  'attribution-reporting': [
    {
      source: 'mdn',
      upstreamId: 'Attribution-Reporting-Register-Source',
      title: 'Attribution-Reporting-Register-Source',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Attribution-Reporting-Register-Source',
      docsUrl: '',
      summary:
        'Reports participation in the Attribution Reporting API and validates the registration headers.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'observe-browsing-topics': [
    {
      source: 'mdn',
      upstreamId: 'Observe-Browsing-Topics',
      title: 'Observe-Browsing-Topics',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Observe-Browsing-Topics',
      docsUrl: '',
      summary:
        'Reports Topics API participation and validates the opt-in boolean.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'set-login': [
    {
      source: 'mdn',
      upstreamId: 'Set-Login',
      title: 'Set-Login',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Login',
      docsUrl: '',
      summary:
        'Validates the FedCM Set-Login login-status header when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'content-digest': [
    {
      source: 'mdn',
      upstreamId: 'Content-Digest',
      title: 'Content-Digest',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Digest',
      docsUrl: '',
      summary:
        'Validates the Content-Digest integrity dictionary (RFC 9530) when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'repr-digest': [
    {
      source: 'mdn',
      upstreamId: 'Repr-Digest',
      title: 'Repr-Digest',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Repr-Digest',
      docsUrl: '',
      summary:
        'Validates the Repr-Digest integrity dictionary (RFC 9530) when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'speculation-rules': [
    {
      source: 'mdn',
      upstreamId: 'Speculation-Rules',
      title: 'Speculation-Rules',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Speculation-Rules',
      docsUrl: '',
      summary:
        'Validates that the Speculation-Rules header lists quoted ruleset URLs.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'supports-loading-mode': [
    {
      source: 'mdn',
      upstreamId: 'Supports-Loading-Mode',
      title: 'Supports-Loading-Mode',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Supports-Loading-Mode',
      docsUrl: '',
      summary: 'Validates the Supports-Loading-Mode tokens when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'use-as-dictionary': [
    {
      source: 'mdn',
      upstreamId: 'Use-As-Dictionary',
      title: 'Use-As-Dictionary',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Use-As-Dictionary',
      docsUrl: '',
      summary:
        'Validates the Use-As-Dictionary compression-dictionary header when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'service-worker-allowed': [
    {
      source: 'mdn',
      upstreamId: 'Service-Worker-Allowed',
      title: 'Service-Worker-Allowed',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed',
      docsUrl: '',
      summary:
        'Validates that the Service-Worker-Allowed scope is a path or absolute URL.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'accept-post': [
    {
      source: 'mdn',
      upstreamId: 'Accept-Post',
      title: 'Accept-Post',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Post',
      docsUrl: '',
      summary: 'Validates the Accept-Post media-type list when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  'accept-patch': [
    {
      source: 'mdn',
      upstreamId: 'Accept-Patch',
      title: 'Accept-Patch',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Patch',
      docsUrl: '',
      summary: 'Validates the Accept-Patch media-type list when present.',
      licence: 'CC-BY-SA-2.5',
    },
  ],
  // discovery set.
  'rel-me': [
    {
      source: 'indieweb',
      upstreamId: 'rel-me',
      title: 'rel=me',
      url: 'https://microformats.org/wiki/rel-me',
      docsUrl: 'https://indieweb.org/rel-me',
      summary:
        'Reports rel=me identity links and warns when one has no target.',
      licence: 'CC0-1.0',
    },
  ],
  webmention: [
    {
      source: 'w3c',
      upstreamId: 'Webmention',
      title: 'Webmention',
      url: 'https://www.w3.org/TR/webmention/',
      docsUrl: 'https://indieweb.org/Webmention',
      summary:
        'Reports a Webmention endpoint and warns when it is not an absolute URL.',
      licence: 'W3C-20150513',
    },
  ],
  pingback: [
    {
      source: 'original',
      upstreamId: 'Pingback 1.0',
      title: 'Pingback',
      url: 'https://www.hixie.ch/specs/pingback/pingback',
      docsUrl: 'https://indieweb.org/pingback',
      summary:
        'Flags a Pingback endpoint as a legacy spam/amplification risk when present.',
      licence: 'unlicensed spec',
    },
  ],
  webfinger: [
    {
      source: 'ietf',
      upstreamId: 'RFC 7033',
      title: 'WebFinger',
      url: 'https://www.rfc-editor.org/rfc/rfc7033',
      docsUrl: 'https://webfinger.net/',
      summary:
        'Probes /.well-known/webfinger and reports its format when present.',
      licence: 'IETF-Trust',
    },
  ],
  nodeinfo: [
    {
      source: 'original',
      upstreamId: 'NodeInfo',
      title: 'NodeInfo',
      url: 'https://nodeinfo.diaspora.software/protocol.html',
      docsUrl: 'https://github.com/jhass/nodeinfo',
      summary:
        'Validates the /.well-known/nodeinfo links document when present.',
      licence: 'CC0-1.0',
    },
  ],
  'host-meta': [
    {
      source: 'ietf',
      upstreamId: 'RFC 6415',
      title: 'host-meta',
      url: 'https://www.rfc-editor.org/rfc/rfc6415',
      docsUrl: '',
      summary:
        'Validates the /.well-known/host-meta XRD/JRD document when present.',
      licence: 'IETF-Trust',
    },
  ],
  'seo-content-length': [
    {
      source: 'roctify',
      upstreamId: 'Content length',
      title: 'Content length (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page has enough text to be useful.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-keywords-frequent': [
    {
      source: 'roctify',
      upstreamId: 'Most frequent keywords',
      title: 'Most frequent keywords (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Lists the words the page uses most.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-keywords-in-title': [
    {
      source: 'roctify',
      upstreamId: 'Keywords in title',
      title: 'Keywords in title (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the main keywords of the page appear in its title.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-url-friendly': [
    {
      source: 'roctify',
      upstreamId: 'SEO friendly URL',
      title: 'SEO friendly URL (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the URL is short, lower case and readable.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-links': [
    {
      source: 'roctify',
      upstreamId: 'Links',
      title: 'Links (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary:
        'Checks that the page links to other pages, including its own site.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-link-anchor-text': [
    {
      source: 'roctify',
      upstreamId: 'Link anchor text',
      title: 'Link anchor text (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that links have descriptive text.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-deprecated-html': [
    {
      source: 'roctify',
      upstreamId: 'Deprecated HTML tags',
      title: 'Deprecated HTML tags (On-page SEO)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page avoids obsolete HTML elements.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-http-status': [
    {
      source: 'roctify',
      upstreamId: 'HTTP status',
      title: 'HTTP status (Indexing)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page answers with HTTP 200.',
      licence: 'unlicensed site content',
    },
  ],
  'x-content-type-options': [
    {
      source: 'roctify',
      upstreamId: 'MIME sniffing protection',
      title: 'MIME sniffing protection (Security)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that X-Content-Type-Options is nosniff.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-viewport': [
    {
      source: 'roctify',
      upstreamId: 'Mobile viewport',
      title: 'Mobile viewport (Mobile)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that the page sets a mobile viewport.',
      licence: 'unlicensed site content',
    },
  ],
  'seo-responsive-images': [
    {
      source: 'roctify',
      upstreamId: 'Responsive images',
      title: 'Responsive images (Mobile)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that images adapt to the screen size.',
      licence: 'unlicensed site content',
    },
  ],
  'icons-apple-touch-icon-missing': [
    {
      source: 'roctify',
      upstreamId: 'Apple touch icon',
      title: 'Apple touch icon (Mobile)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that an Apple touch icon is declared.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-response-time': [
    {
      source: 'roctify',
      upstreamId: 'Server response time',
      title: 'Server response time (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Times the first response from the server.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-html-size': [
    {
      source: 'roctify',
      upstreamId: 'HTML size',
      title: 'HTML size (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks the weight of the HTML document.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-asset-count': [
    {
      source: 'roctify',
      upstreamId: 'Scripts and stylesheets',
      title: 'Scripts and stylesheets (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Counts the scripts and stylesheets the page loads.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-image-formats': [
    {
      source: 'roctify',
      upstreamId: 'Modern image formats',
      title: 'Modern image formats (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that images use formats such as WebP or AVIF.',
      licence: 'unlicensed site content',
    },
  ],
  'technical-lazy-loading': [
    {
      source: 'roctify',
      upstreamId: 'Lazy loading',
      title: 'Lazy loading (Performance)',
      url: 'https://roctify.com/tools/seo-checker',
      docsUrl: '',
      summary: 'Checks that images below the fold load lazily.',
      licence: 'unlicensed site content',
    },
  ],
};
