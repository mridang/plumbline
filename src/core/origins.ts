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
};
