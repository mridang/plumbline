/**
 * The references the hints were ported from, for bookkeeping. `id` is the
 * source group a hint lists in its `groups`. The same list is stamped into
 * `package.json` under `sources`, and a test keeps the two equal.
 */
export interface Source {
  id: string;
  name: string;
  url: string;
  licence: string;
}

export const SOURCES: readonly Source[] = [
  {
    id: 'observatory',
    name: 'MDN HTTP Observatory',
    url: 'https://github.com/mdn/mdn-http-observatory',
    licence: 'MPL-2.0',
  },
  {
    id: 'owasp',
    name: 'OWASP Secure Headers Project validator',
    url: 'https://github.com/OWASP/secure-headers-project',
    licence: 'Apache-2.0',
  },
  {
    id: 'opengraph',
    name: 'OpenGraph.to articles',
    url: 'https://www.opengraph.to/articles',
    licence: 'unlicensed site content',
  },
  {
    id: 'agent-ready',
    name: 'Is it agent ready',
    url: 'https://isitagentready.com',
    licence: 'unlicensed site content',
  },
  {
    id: 'webbkoll',
    name: 'Webbkoll',
    url: 'https://codeberg.org/dataskydd.net/webbkoll',
    licence: 'MIT',
  },
  {
    id: 'internetnl',
    name: 'Internet.nl',
    url: 'https://github.com/internetstandards/Internet.nl',
    licence: 'Apache-2.0 (code), CC-BY-4.0 (documentation)',
  },
  {
    id: 'files',
    name: 'LLMs.txt Validator and the file specifications',
    url: 'https://llmstxtvalidator.dev',
    licence: 'unlicensed site content, IETF RFCs',
  },
  {
    id: 'llmscout',
    name: 'LLMScout',
    url: 'https://github.com/RudrenduPaul/LLMScout',
    licence: 'MIT',
  },
  {
    id: 'mdn',
    name: 'MDN HTTP headers reference',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers',
    licence: 'CC-BY-SA-2.5',
  },
  {
    id: 'original',
    name: 'Written for this package',
    url: 'https://github.com/mridang/webhint-hints',
    licence: 'Apache-2.0',
  },
  {
    id: 'w3c',
    name: 'W3C specifications and community group reports',
    url: 'https://www.w3.org/',
    licence: 'W3C Document License',
  },
  {
    id: 'iab',
    name: 'IAB Tech Lab ads.txt, app-ads.txt and sellers.json',
    url: 'https://iabtechlab.com/ads-txt/',
    licence: 'unlicensed site content',
  },
  {
    id: 'indieweb',
    name: 'IndieWeb (humans.txt, microformats, rel=me)',
    url: 'https://humanstxt.org/',
    licence: 'unlicensed site content',
  },
  {
    id: 'apple',
    name: 'Apple Developer Documentation',
    url: 'https://developer.apple.com/documentation/',
    licence: 'unlicensed site content',
  },
  {
    id: 'google',
    name: 'Google developer documentation (Search Central, rich results, CSP Evaluator, Digital Asset Links)',
    url: 'https://developers.google.com/',
    licence: 'unlicensed site content',
  },
  {
    id: 'ietf',
    name: 'IETF RFCs and the RSS 2.0 specification',
    url: 'https://www.rfc-editor.org/',
    licence: 'IETF Trust (RFC text)',
  },
  {
    id: 'oembed',
    name: 'oEmbed specification',
    url: 'https://oembed.com/',
    licence: 'unlicensed site content',
  },
  {
    id: 'opensearch',
    name: 'OpenSearch 1.1 specification',
    url: 'https://github.com/dewitt/opensearch',
    licence: 'unlicensed specification text',
  },
  {
    id: 'roctify',
    name: 'Roctify SEO checker',
    url: 'https://roctify.com/tools/seo-checker',
    licence: 'unlicensed site content',
  },
];
