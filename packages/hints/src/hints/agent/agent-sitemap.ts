import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discoverability: a sitemap lets agents enumerate pages without crawling.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-sitemap',
  name: 'Sitemap for agents',
  description:
    'Requires a valid XML sitemap listed in robots.txt or at /sitemap.xml.',
  reference: 'https://www.sitemaps.org/protocol.html',
  extraGroups: ['roctify', 'seo'],
});
