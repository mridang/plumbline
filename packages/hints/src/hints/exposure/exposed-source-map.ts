import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite, type Page, type Site } from '../../core/page.js';
import { isExposedSourceMap } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information';

/**
 * Resolves a script URL against the page and guesses its `.map` sibling.
 * Returns undefined when the URL is not parseable or not a same-origin `.js`.
 */
function sourceMapPath(src: string, site: Site): string | undefined {
  let scriptUrl: URL;
  try {
    scriptUrl = new URL(src, site.url);
  } catch {
    return undefined;
  }
  if (scriptUrl.origin !== site.origin || !/\.js$/i.test(scriptUrl.pathname)) {
    return undefined;
  }
  return `${scriptUrl.pathname}.map`;
}

/**
 * Probes for a reachable JavaScript source map that exposes original source.
 * The hint collects the `<script src>` URLs on the page, then for each guesses
 * the conventional `<script>.map` sibling, fetches it and reports only when
 * the body is a valid v3 source map with a populated `sources` array (so a
 * catch-all HTML page or an unrelated JSON file is not flagged). Shipping a
 * source map to production discloses the pre-minification source.
 * Source: OWASP WSTG-CONF-04 (source-code disclosure via unreferenced files).
 */
export default defineHint({
  id: 'exposed-source-map',
  name: 'Exposed JavaScript source map',
  description:
    'Reports when a referenced script has a reachable, valid .js.map source map.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    // Gather the script URLs while the page DOM is available, then do the
    // fetching after the scan, when onSite can reach other URLs.
    const scripts: string[] = [];
    onPage(context, (page: Page) => {
      for (const el of page.document.querySelectorAll('script[src]')) {
        const src = el.getAttribute('src');
        if (src) {
          scripts.push(src);
        }
      }
    });
    onSite(context, async (site) => {
      const mapPaths = new Set<string>();
      for (const src of scripts) {
        const mapPath = sourceMapPath(src, site);
        if (mapPath !== undefined) {
          mapPaths.add(mapPath);
        }
      }
      for (const mapPath of mapPaths) {
        const body = await fetchIfReachable(site, mapPath);
        if (body !== null && isExposedSourceMap(body)) {
          reportExposure(
            site,
            mapPath,
            `A JavaScript source map is reachable at ${mapPath}, exposing the original source.`,
            body,
          );
        }
      }
    });
  },
});
