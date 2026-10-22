import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  opensearchDiscovery,
  OPENSEARCH_DISCOVERY_REF,
} from '../../lib/feeds/checks.js';
import { OPENSEARCH_TYPE } from '../../lib/feeds/read.js';
import { isAbsoluteUrl } from '../../lib/files/issue.js';
import { toSeverity } from './to-severity.js';

const REF = OPENSEARCH_DISCOVERY_REF;

/**
 * Checks OpenSearch autodiscovery.
 *
 * A site that offers search advertises its description document with
 * `<link rel="search" type="application/opensearchdescription+xml" href=...>`,
 * which the browser resolves and fetches to add the site to its search box.
 * Source: the OpenSearch specification, "Autodiscovery".
 *
 * This is a DOM-only check, single-sourced in `src/lib/feeds/checks.ts` and
 * also run as a Lighthouse audit; the hint only adds the offending element or a
 * suggested snippet.
 */
export default defineHint({
  id: 'opensearch-discovery',
  name: 'OpenSearch description is discoverable',
  description:
    'Checks for an OpenSearch <link rel="search" type="application/opensearchdescription+xml">.',
  category: Category.development,
  // `original`/`social` are the closest existing groups; the feeds set adds its
  // own source and topic groups through `manifest.ts`, which the lead wires in.
  groups: ['opensearch', 'social'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = opensearchDiscovery(page.document);
      if (findings.length === 0) {
        return;
      }
      // The warnings line up one-to-one, in document order, with the OpenSearch
      // `<link>`s whose href is not absolute.
      const offenders = page.document
        .querySelectorAll('link[rel~="search" i][type]')
        .filter((element) => {
          const type = (element.getAttribute('type') ?? '')
            .trim()
            .toLowerCase();
          const href = (element.getAttribute('href') ?? '').trim();
          return type === OPENSEARCH_TYPE && !isAbsoluteUrl(href);
        });
      let offenderIndex = 0;
      for (const found of findings) {
        if (found.severity === 'hint') {
          page.report(found.message, {
            severity: toSeverity(found.severity),
            element: page.document.querySelector('head'),
            codeSnippet: `<link rel="search" type="application/opensearchdescription+xml" title="Search" href="${page.url}opensearch.xml">`,
            codeLanguage: 'html',
          });
        } else {
          const element = offenders[offenderIndex];
          offenderIndex += 1;
          page.report(found.message, {
            severity: toSeverity(found.severity),
            ...(element ? { element } : {}),
          });
        }
      }
    });
  },
});
