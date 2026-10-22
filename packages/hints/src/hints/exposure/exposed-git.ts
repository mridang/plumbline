import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import {
  looksLikeGitConfig,
  looksLikeGitHead,
} from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes for an exposed `.git` directory. A deployed `.git` lets an attacker
 * reconstruct the whole repository — source, history and any secrets ever
 * committed. The hint fetches `/.git/HEAD` and, as a fallback, `/.git/config`,
 * and reports only when the body confirms a real git directory (a `ref:` or
 * commit-id HEAD, or a config with `[core] repositoryformatversion`), so a
 * single-page app that serves `index.html` for every path is not flagged.
 * Source: OWASP WSTG-CONF-04 (review old/unreferenced files, source-code
 * disclosure).
 */
export default defineHint({
  id: 'exposed-git',
  name: 'Exposed .git directory',
  description:
    'Reports when /.git/HEAD or /.git/config is served, exposing the repository.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      const head = await fetchIfReachable(site, '/.git/HEAD');
      if (head !== null && looksLikeGitHead(head)) {
        reportExposure(
          site,
          '/.git/HEAD',
          'The .git directory is exposed: /.git/HEAD is readable and reveals the repository.',
          head,
        );
        return;
      }
      const config = await fetchIfReachable(site, '/.git/config');
      if (config !== null && looksLikeGitConfig(config)) {
        reportExposure(
          site,
          '/.git/config',
          'The .git directory is exposed: /.git/config is readable and reveals the repository.',
          config,
        );
      }
    });
  },
});
