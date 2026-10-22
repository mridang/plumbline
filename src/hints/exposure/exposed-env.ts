import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { looksLikeEnvFile } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes for an exposed `.env` file. Dotenv files hold database credentials,
 * API keys and framework secrets, so a readable `/.env` is a direct leak. The
 * hint reports only when the body contains at least one `KEY=VALUE`
 * assignment and is not an HTML page, so a catch-all 200 returning the SPA
 * shell does not trip it.
 * Source: OWASP WSTG-CONF-04 (review old/unreferenced files).
 */
export default defineHint({
  id: 'exposed-env',
  name: 'Exposed .env file',
  description:
    'Reports when /.env is served with KEY=VALUE content, leaking secrets.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      const body = await fetchIfReachable(site, '/.env');
      if (body !== null && looksLikeEnvFile(body)) {
        reportExposure(
          site,
          '/.env',
          'The /.env file is readable and exposes environment variables and secrets.',
          body,
        );
      }
    });
  },
});
