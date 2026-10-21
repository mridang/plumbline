/**
 * The sections hints are sorted into, shown as the sidebar of the report. A
 * hint has one primary category and optional tags for the others it touches.
 * Proposed by two teams of reviewers and settled by a judge; see README.md.
 */
export interface TaxonomyCategory {
  id: string;
  title: string;
  /** One line explaining what the section holds. */
  description: string;
  /** Who usually has to make the fix, which settles borderline cases. */
  whoFixesIt: string;
}

export interface Placement {
  category: string;
  tags: readonly string[];
}

export const CATEGORIES: readonly TaxonomyCategory[] = [
  {
    id: 'llms-ai',
    title: 'LLMs and AI',
    description:
      'Everything that tells bots and AI systems what they may read and how to use you: robots.txt, llms.txt, ai.txt, AI crawler rules, Content Signals, agent discovery, auth and payment protocols, Web Bot Auth, markdown negotiation and answer-engine markup.',
    whoFixesIt:
      'site content, files at the web root and /.well-known, web server config',
  },
  {
    id: 'search',
    title: 'Search and page quality',
    description:
      'Be found and understood by search engines: titles, descriptions, headings, lang, canonical, robots meta, JSON-LD, alt text, image weight, redirect chains.',
    whoFixesIt: 'site content and templates',
  },
  {
    id: 'social-previews',
    title: 'Link previews and icons',
    description:
      'How the site looks when shared or bookmarked: Open Graph, Twitter/X cards and favicons.',
    whoFixesIt: 'site content and templates (the HTML head)',
  },
  {
    id: 'https-tls',
    title: 'HTTPS and certificates',
    description:
      'Visitors reach the real site over a trusted encrypted connection: TLS versions, ciphers, certificates, mail-server STARTTLS, compression risk.',
    whoFixesIt: 'web server or CDN TLS config',
  },
  {
    id: 'site-protection',
    title: 'Site protection',
    description:
      'Make the site hard to attack from a browser: CSP, framing, cross-origin policies, CORS, cookie flags, HSTS-adjacent header rules, deprecated headers, private-page caching, security.txt.',
    whoFixesIt: 'web server or application config (response headers)',
  },
  {
    id: 'visitor-privacy',
    title: 'Visitor privacy',
    description:
      'What the site reveals about its visitors: cookies, third-party requests, localStorage, geolocation, referrer and DNS-prefetch leakage, third-party report endpoints.',
    whoFixesIt: 'site content, scripts and header config',
  },
  {
    id: 'email',
    title: 'Email security',
    description:
      'Mail sent as your domain is trusted and cannot be spoofed: SPF, DKIM, DMARC, STARTTLS, and DNSSEC, DANE, IPv6 and RPKI of the mail servers.',
    whoFixesIt: 'mail admin / mail DNS records',
  },
  {
    id: 'dns-network',
    title: 'DNS and network',
    description:
      'The domain, name servers and web server are reachable and tamper-resistant: DNSSEC, IPv6, RPKI, DANE and CAA.',
    whoFixesIt: 'DNS zone, registrar, hosting/network provider',
  },
];

/** The category of every hint, by hint id. */
export const PLACEMENT: Readonly<Record<string, Placement>> = {
  'agent-a2a-agent-card': { category: 'llms-ai', tags: [] },
  'agent-acp': { category: 'llms-ai', tags: [] },
  'agent-ai-bot-rules': { category: 'llms-ai', tags: ['visitor-privacy'] },
  'agent-api-catalog': { category: 'llms-ai', tags: [] },
  'agent-ard': { category: 'llms-ai', tags: [] },
  'agent-auth-md': { category: 'llms-ai', tags: [] },
  'agent-content-signals': { category: 'llms-ai', tags: ['visitor-privacy'] },
  'agent-dns-aid': { category: 'llms-ai', tags: ['dns-network'] },
  'agent-link-headers': { category: 'llms-ai', tags: [] },
  'agent-markdown-negotiation': { category: 'llms-ai', tags: [] },
  'agent-mcp-server-card': { category: 'llms-ai', tags: [] },
  'agent-mpp': { category: 'llms-ai', tags: [] },
  'agent-oauth-discovery': { category: 'llms-ai', tags: [] },
  'agent-oauth-protected-resource': { category: 'llms-ai', tags: [] },
  'agent-poppy': { category: 'llms-ai', tags: [] },
  'agent-robots-txt': { category: 'llms-ai', tags: ['search'] },
  'agent-score': { category: 'llms-ai', tags: [] },
  'agent-sitemap': { category: 'llms-ai', tags: ['search'] },
  'agent-skills': { category: 'llms-ai', tags: [] },
  'agent-ucp': { category: 'llms-ai', tags: [] },
  'agent-web-bot-auth': { category: 'llms-ai', tags: ['site-protection'] },
  'agent-webmcp': { category: 'llms-ai', tags: [] },
  'agent-x402': { category: 'llms-ai', tags: [] },
  'ai-txt': { category: 'llms-ai', tags: [] },
  caa: { category: 'dns-network', tags: ['https-tls'] },
  'cache-control': { category: 'site-protection', tags: ['visitor-privacy'] },
  'cert-hostname': { category: 'https-tls', tags: [] },
  'cert-pubkey': { category: 'https-tls', tags: [] },
  'cert-signature': { category: 'https-tls', tags: [] },
  'cert-trust': { category: 'https-tls', tags: [] },
  'clear-site-data': { category: 'site-protection', tags: [] },
  coep: { category: 'site-protection', tags: [] },
  cookies: { category: 'site-protection', tags: ['visitor-privacy'] },
  coop: { category: 'site-protection', tags: [] },
  corp: { category: 'site-protection', tags: [] },
  cors: { category: 'site-protection', tags: [] },
  csp: { category: 'site-protection', tags: [] },
  'csp-reporting': { category: 'visitor-privacy', tags: ['site-protection'] },
  'dane-exists': { category: 'dns-network', tags: ['https-tls'] },
  'dane-valid': { category: 'dns-network', tags: ['https-tls'] },
  'dnssec-exists': { category: 'dns-network', tags: [] },
  'dnssec-valid': { category: 'dns-network', tags: [] },
  'expect-ct': { category: 'site-protection', tags: [] },
  'feature-policy': { category: 'site-protection', tags: [] },
  'geo-content-extraction': { category: 'llms-ai', tags: ['search'] },
  'geo-faq-schema': { category: 'llms-ai', tags: ['search'] },
  'geo-organization-schema': { category: 'llms-ai', tags: ['search'] },
  'geo-speakable-schema': { category: 'llms-ai', tags: ['search'] },
  'geo-structured-data-invalid': { category: 'search', tags: ['llms-ai'] },
  hsts: { category: 'https-tls', tags: ['site-protection'] },
  'icons-favicon-32-missing': { category: 'social-previews', tags: ['search'] },
  'icons-favicon-ico-or-png-missing': {
    category: 'social-previews',
    tags: ['search'],
  },
  'icons-favicon-missing': { category: 'social-previews', tags: ['search'] },
  'icons-favicon-svg-missing': {
    category: 'social-previews',
    tags: ['search'],
  },
  'internetnl-http-compression': {
    category: 'site-protection',
    tags: ['https-tls'],
  },
  'ipv6-ns-aaaa': { category: 'dns-network', tags: [] },
  'ipv6-ns-reach': { category: 'dns-network', tags: [] },
  'ipv6-same-content': { category: 'dns-network', tags: [] },
  'ipv6-web-aaaa': { category: 'dns-network', tags: [] },
  'ipv6-web-reach': { category: 'dns-network', tags: [] },
  'llms-full-txt': { category: 'llms-ai', tags: [] },
  'llms-txt': { category: 'llms-ai', tags: [] },
  'mail-dane': { category: 'email', tags: ['dns-network'] },
  'mail-dkim': { category: 'email', tags: [] },
  'mail-dmarc': { category: 'email', tags: [] },
  'mail-dnssec': { category: 'email', tags: ['dns-network'] },
  'mail-ipv6': { category: 'email', tags: ['dns-network'] },
  'mail-rpki': { category: 'email', tags: ['dns-network'] },
  'mail-spf': { category: 'email', tags: [] },
  'mail-starttls': { category: 'email', tags: ['https-tls'] },
  'opengraph-description-could-be-longer': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-description-is-url': { category: 'social-previews', tags: [] },
  'opengraph-description-keyword-stuffing': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-description-missing': {
    category: 'social-previews',
    tags: ['search'],
  },
  'opengraph-description-same-as-title': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-description-slightly-long': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-description-too-long': { category: 'social-previews', tags: [] },
  'opengraph-description-too-short': { category: 'social-previews', tags: [] },
  'opengraph-image-alt-missing': {
    category: 'social-previews',
    tags: ['search'],
  },
  'opengraph-image-broken': { category: 'social-previews', tags: [] },
  'opengraph-image-dimensions-missing': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-image-dimensions-too-large': {
    category: 'social-previews',
    tags: [],
  },
  'opengraph-image-missing': { category: 'social-previews', tags: [] },
  'opengraph-image-non-optimal-size': { category: 'social-previews', tags: [] },
  'opengraph-image-not-https': { category: 'social-previews', tags: [] },
  'opengraph-image-too-large': { category: 'social-previews', tags: [] },
  'opengraph-image-too-small': { category: 'social-previews', tags: [] },
  'opengraph-locale-missing': { category: 'social-previews', tags: [] },
  'opengraph-site-name-missing': { category: 'social-previews', tags: [] },
  'opengraph-title-missing': { category: 'social-previews', tags: ['search'] },
  'opengraph-title-too-long': { category: 'social-previews', tags: [] },
  'opengraph-title-too-short': { category: 'social-previews', tags: [] },
  'opengraph-type-missing': { category: 'social-previews', tags: [] },
  'opengraph-url-missing': { category: 'social-previews', tags: [] },
  'permissions-policy': { category: 'site-protection', tags: [] },
  'privacy-cookies': { category: 'visitor-privacy', tags: [] },
  'privacy-geolocation': { category: 'visitor-privacy', tags: [] },
  'privacy-insecure-first-party': {
    category: 'https-tls',
    tags: ['visitor-privacy'],
  },
  'privacy-local-storage': { category: 'visitor-privacy', tags: [] },
  'privacy-mixed-content': {
    category: 'https-tls',
    tags: ['visitor-privacy', 'site-protection'],
  },
  'privacy-third-party-requests': { category: 'visitor-privacy', tags: [] },
  'public-key-pins': { category: 'site-protection', tags: [] },
  redirection: { category: 'https-tls', tags: ['site-protection'] },
  'referrer-policy': { category: 'visitor-privacy', tags: ['site-protection'] },
  'robots-txt': { category: 'llms-ai', tags: ['search'] },
  'rpki-ns-exists': { category: 'dns-network', tags: [] },
  'rpki-ns-valid': { category: 'dns-network', tags: [] },
  'rpki-web-exists': { category: 'dns-network', tags: [] },
  'rpki-web-valid': { category: 'dns-network', tags: [] },
  'security-txt': { category: 'site-protection', tags: [] },
  'seo-canonical-mismatch': { category: 'search', tags: [] },
  'seo-canonical-missing': { category: 'search', tags: [] },
  'seo-h1-missing': { category: 'search', tags: [] },
  'seo-h1-multiple': { category: 'search', tags: [] },
  'seo-html-lang-missing': { category: 'search', tags: [] },
  'seo-meta-description-missing': { category: 'search', tags: [] },
  'seo-meta-description-too-long': { category: 'search', tags: [] },
  'seo-meta-description-too-short': { category: 'search', tags: [] },
  'seo-robots-nofollow': { category: 'search', tags: [] },
  'seo-robots-noindex': { category: 'search', tags: ['llms-ai'] },
  'seo-structured-data-missing': { category: 'search', tags: ['llms-ai'] },
  'seo-title-missing': { category: 'search', tags: [] },
  'seo-title-too-long': { category: 'search', tags: [] },
  'seo-title-too-short': { category: 'search', tags: [] },
  'technical-canonical-invalid': { category: 'search', tags: [] },
  'technical-heading-hierarchy': { category: 'search', tags: [] },
  'technical-image-alt-coverage': { category: 'search', tags: ['llms-ai'] },
  'technical-image-weight': { category: 'search', tags: [] },
  'technical-redirect-chain': { category: 'search', tags: ['https-tls'] },
  'technical-robots-meta-advanced': { category: 'search', tags: ['llms-ai'] },
  'technical-twitter-card-type': {
    category: 'social-previews',
    tags: ['search'],
  },
  'tls-cipher-order': { category: 'https-tls', tags: [] },
  'tls-ciphers': { category: 'https-tls', tags: [] },
  'tls-compression': { category: 'https-tls', tags: [] },
  'tls-ems': { category: 'https-tls', tags: [] },
  'tls-kex-hash': { category: 'https-tls', tags: [] },
  'tls-kex-params': { category: 'https-tls', tags: [] },
  'tls-ocsp-stapling': { category: 'https-tls', tags: [] },
  'tls-renegotiation-client': { category: 'https-tls', tags: [] },
  'tls-renegotiation-secure': { category: 'https-tls', tags: [] },
  'tls-version': { category: 'https-tls', tags: [] },
  'tls-zero-rtt': { category: 'https-tls', tags: [] },
  'twitter-card-missing': { category: 'social-previews', tags: [] },
  'twitter-card-not-large': { category: 'social-previews', tags: [] },
  'twitter-description-missing': { category: 'social-previews', tags: [] },
  'twitter-image-missing': { category: 'social-previews', tags: [] },
  'twitter-site-missing': { category: 'social-previews', tags: [] },
  'twitter-title-missing': { category: 'social-previews', tags: [] },
  'x-dns-prefetch-control': {
    category: 'visitor-privacy',
    tags: ['site-protection'],
  },
  'x-frame-options': { category: 'site-protection', tags: [] },
  'x-permitted-cross-domain-policies': {
    category: 'site-protection',
    tags: [],
  },
  'x-xss-protection': { category: 'site-protection', tags: [] },
};
