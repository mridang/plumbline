import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { usesGeolocation } from '../../lib/privacy/geolocation.js';

/**
 * Looks for page code that asks for the visitor's position through the
 * Geolocation API (`getCurrentPosition` or `watchPosition`), in inline scripts
 * and in every script the page loads. Location is personal data, so using it
 * should be a deliberate, disclosed choice (GDPR art. 5.1.c and 25).
 *
 * Webbkoll's own "geolocation" section is about the location of the server's
 * IP address, which needs a GeoIP lookup this package does not have. This hint
 * is the page-side counterpart and an addition to Webbkoll, not a port of it.
 * Feature detection alone, comments and strings are not reported.
 */
export default defineHint({
  id: 'privacy-geolocation',
  name: 'Geolocation use',
  description: 'Finds inline and loaded scripts that use the Geolocation API.',
  category: Category.security,
  groups: ['webbkoll', 'privacy'],
  reference: 'https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API',
  setup(context) {
    let url = '';
    const found = new Set<string>();
    context.on('scan::start', (event) => {
      url = event.resource;
    });
    // Inline scripts live in the DOM.
    context.on('traverse::end', (event) => {
      for (const script of event.document.querySelectorAll(
        'script:not([src])',
      )) {
        if (usesGeolocation(script.textContent ?? '')) {
          found.add(`${url} (inline script)`);
        }
      }
    });
    // External scripts are fetched by the connector.
    context.on('fetch::end::script', (event) => {
      if (usesGeolocation(event.response.body.content)) {
        found.add(event.resource);
      }
    });
    context.on('scan::end', () => {
      for (const source of found) {
        context.report(
          url,
          `The script ${source} uses the Geolocation API to read the visitor's position.`,
          {
            severity: Severity.warning,
          },
        );
      }
    });
  },
});
