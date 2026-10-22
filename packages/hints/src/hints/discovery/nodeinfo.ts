import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { nodeinfoFindings } from '../../lib/discovery/nodeinfo.js';
import { reportSiteFindings } from '../headers/shared.js';

const PATH = '/.well-known/nodeinfo';

/**
 * NodeInfo: a Fediverse server advertises its metadata through a discovery
 * document at `/.well-known/nodeinfo` (a JSON object with a `links` array).
 * This hint fetches that document and validates its shape when present; it is
 * silent when NodeInfo is not offered.
 */
export default defineHint({
  id: 'nodeinfo',
  name: 'NodeInfo discovery document',
  description:
    'Validates the /.well-known/nodeinfo links document when present (Fediverse NodeInfo).',
  category: Category.development,
  groups: ['original', 'agent'],
  reference: 'https://nodeinfo.diaspora.software/protocol.html',
  setup(context) {
    onSite(context, async (site) => {
      const data = await site.fetch(PATH);
      if (!data) {
        return;
      }
      const findings = nodeinfoFindings({
        statusCode: data.response.statusCode,
        body: data.response.body.content,
      });
      reportSiteFindings(site, new URL(PATH, site.url).href, findings);
    });
  },
});
