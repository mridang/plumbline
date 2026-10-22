import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { webfingerFindings } from '../../lib/discovery/webfinger.js';
import { reportSiteFindings } from '../headers/shared.js';

const PATH = '/.well-known/webfinger';

/**
 * WebFinger (RFC 7033): the endpoint at `/.well-known/webfinger` resolves
 * account metadata and underpins Fediverse handle lookup. This hint probes the
 * endpoint (without a `resource`, as a bare GET) and reports its shape when it
 * responds; it is silent when WebFinger is not offered.
 */
export default defineHint({
  id: 'webfinger',
  name: 'WebFinger endpoint',
  description:
    'Probes /.well-known/webfinger and reports its format when present (RFC 7033).',
  category: Category.development,
  groups: ['ietf', 'agent'],
  reference: 'https://www.rfc-editor.org/rfc/rfc7033',
  setup(context) {
    onSite(context, async (site) => {
      const data = await site.fetch(PATH);
      if (!data) {
        return;
      }
      const findings = webfingerFindings({
        statusCode: data.response.statusCode,
        mediaType: data.response.mediaType,
        body: data.response.body.content,
      });
      reportSiteFindings(site, new URL(PATH, site.url).href, findings);
    });
  },
});
