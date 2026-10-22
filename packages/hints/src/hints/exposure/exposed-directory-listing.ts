import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { looksLikeDirectoryListing } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes a few common directories for an automatic index. When a server is
 * left with directory listing on (Apache `mod_autoindex`, nginx `autoindex`,
 * Python's `http.server`), browsing a folder with no index file returns a
 * generated listing of its contents, disclosing files that were never linked.
 * The hint reports only when a probed directory returns a body whose heading
 * is `Index of /` or `Directory listing for /`, so an ordinary page or a SPA
 * shell is not mistaken for a listing.
 * Source: OWASP WSTG-CONF-04 (review old/unreferenced files).
 */
export default defineHint({
  id: 'exposed-directory-listing',
  name: 'Exposed directory listing',
  description:
    'Reports when a common directory returns an automatic index of its files.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      // A short, documented set of directories that commonly exist and are
      // commonly left browsable.
      const directories = ['/images/', '/uploads/', '/assets/', '/files/'];
      for (const path of directories) {
        const body = await fetchIfReachable(site, path);
        if (body !== null && looksLikeDirectoryListing(body)) {
          reportExposure(
            site,
            path,
            `Directory listing is enabled for ${path}, disclosing its contents.`,
            body.replace(/\s+/g, ' ').trim(),
          );
          // One finding is enough to make the point; a misconfigured server
          // usually lists every directory.
          return;
        }
      }
    });
  },
});
