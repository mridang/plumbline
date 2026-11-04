import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { responseTimeFindings } from '../../lib/technical/speed.js';
import { toSeverity } from '../seo/to-severity.js';

/**
 * Warns when the page took more than 600 ms to arrive and errors above 1.5 s.
 * Source: Roctify SEO checker "Server response time". The time runs from the
 * start of the fetch to the response, so a browser based connector adds its
 * own overhead; treat a borderline value as approximate.
 */
export default defineHint({
  id: 'technical-response-time',
  name: 'Server responds quickly',
  description: 'Warns when the first response took more than 600 ms.',
  category: Category.performance,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    let started = performance.now();
    let elapsed: number | null = null;
    context.on('scan::start', () => {
      started = performance.now();
    });
    context.on('fetch::start::target', () => {
      started = performance.now();
    });
    context.on('fetch::end::html', () => {
      elapsed ??= performance.now() - started;
    });
    // Reported once the scan is over so the time is known whatever the order
    // of the connector's and parser's events.
    onSite(context, (site) => {
      if (elapsed === null) {
        return;
      }
      for (const found of responseTimeFindings(elapsed)) {
        site.report(site.url.href, found.message, {
          severity: toSeverity(found.severity),
        });
      }
    });
  },
});
