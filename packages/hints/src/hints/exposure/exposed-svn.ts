import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import {
  looksLikeSqlite,
  looksLikeSvnEntries,
} from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes for an exposed Subversion working copy. Like `.git`, a deployed
 * `.svn` directory discloses source and history. The hint fetches the legacy
 * text `/.svn/entries` (first line is a format-version integer) and, as a
 * fallback, the modern `/.svn/wc.db` SQLite database (fixed `SQLite format 3`
 * magic). It reports only when the body matches one of those shapes, never
 * for an HTML catch-all page.
 * Source: OWASP WSTG-CONF-04 (review old/unreferenced files, source-code
 * disclosure).
 */
export default defineHint({
  id: 'exposed-svn',
  name: 'Exposed .svn directory',
  description:
    'Reports when /.svn/entries or /.svn/wc.db is served, exposing the repository.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      const entries = await fetchIfReachable(site, '/.svn/entries');
      if (entries !== null && looksLikeSvnEntries(entries)) {
        reportExposure(
          site,
          '/.svn/entries',
          'The .svn directory is exposed: /.svn/entries is readable and reveals the repository.',
          entries,
        );
        return;
      }
      const wcdb = await fetchIfReachable(site, '/.svn/wc.db');
      if (wcdb !== null && looksLikeSqlite(wcdb)) {
        reportExposure(
          site,
          '/.svn/wc.db',
          'The .svn directory is exposed: /.svn/wc.db is readable and reveals the repository.',
          'SQLite format 3',
        );
      }
    });
  },
});
