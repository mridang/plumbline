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
    id: 'original',
    name: 'Written for this package',
    url: 'https://github.com/mridang/webhint-hints',
    licence: 'Apache-2.0',
  },
];
