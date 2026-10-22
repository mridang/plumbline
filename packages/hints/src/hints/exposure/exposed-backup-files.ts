import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { BACKUP_PROBES, confirmsBackup } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Probes a small, curated list of common backup and editor files
 * (`/index.php.bak`, `/.htaccess.bak`, `/backup.zip`, `/config.php~`). These
 * are left behind by deploys and editors and, when served, leak source and
 * configuration. The hint reports only when the body confirms the kind of
 * artifact — PHP source for `.php` backups, an Apache directive for the
 * `.htaccess` backup, the ZIP magic for the archive — so a catch-all HTML
 * page is never flagged.
 * Source: OWASP WSTG-CONF-04 (review old backup and unreferenced files).
 */
export default defineHint({
  id: 'exposed-backup-files',
  name: 'Exposed backup files',
  description:
    'Reports when common backup files are served, leaking source or config.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      for (const probe of BACKUP_PROBES) {
        const body = await fetchIfReachable(site, probe.path);
        if (body !== null && confirmsBackup(probe.path, body)) {
          reportExposure(
            site,
            probe.path,
            `A backup file is reachable at ${probe.path} (${probe.label}), leaking source or configuration.`,
            body,
          );
        }
      }
    });
  },
});
