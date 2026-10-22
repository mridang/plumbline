import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { looksLikeDsStore } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes for an exposed macOS `.DS_Store` file. These files list the names of
 * every item in the directory they were created in, so a readable `/.DS_Store`
 * leaks the layout of the web root and can reveal unlinked files. The hint
 * reports only when the body carries the `.DS_Store` binary signature
 * (`00 00 00 01` then `Bud1`), so an HTML catch-all response is never flagged.
 * Source: OWASP WSTG-CONF-04 (review old/unreferenced files).
 */
export default defineHint({
  id: 'exposed-ds-store',
  name: 'Exposed .DS_Store file',
  description: 'Reports when /.DS_Store is served, leaking directory contents.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      const body = await fetchIfReachable(site, '/.DS_Store');
      if (body !== null && looksLikeDsStore(body)) {
        reportExposure(
          site,
          '/.DS_Store',
          'The /.DS_Store file is readable and leaks the names of files in the web root.',
          'Bud1 (.DS_Store signature)',
        );
      }
    });
  },
});
