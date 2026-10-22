import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { hostMetaFindings } from '../../lib/discovery/host-meta.js';
import { reportSiteFindings } from '../headers/shared.js';

const PATH = '/.well-known/host-meta';

/**
 * `host-meta` (RFC 6415): a host describes its metadata and resource templates
 * at `/.well-known/host-meta`, as an XRD XML document (or a JRD JSON document).
 * This hint fetches that file and validates whichever form is served when
 * present; it is silent when host-meta is not offered.
 */
export default defineHint({
  id: 'host-meta',
  name: 'host-meta document',
  description:
    'Validates the /.well-known/host-meta XRD/JRD document when present (RFC 6415).',
  category: Category.development,
  groups: ['ietf', 'agent'],
  reference: 'https://www.rfc-editor.org/rfc/rfc6415',
  setup(context) {
    onSite(context, async (site) => {
      const data = await site.fetch(PATH);
      if (!data) {
        return;
      }
      const findings = hostMetaFindings({
        statusCode: data.response.statusCode,
        mediaType: data.response.mediaType,
        body: data.response.body.content,
      });
      reportSiteFindings(site, new URL(PATH, site.url).href, findings);
    });
  },
});
