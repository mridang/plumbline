import { Severity } from '@hint/utils-types';
import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  findGeolocationCall,
  type GeolocationCall,
} from '../../lib/privacy/geolocation.js';

/** One script that uses the API and where. */
interface Finding {
  resource: string;
  source: string;
  call: GeolocationCall;
  /** The inline script element, absent for a fetched script. */
  element?: HTMLElement;
}

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
    const found = new Map<string, Finding>();
    context.on('scan::start', (event) => {
      url = event.resource;
    });
    // Inline scripts live in the DOM.
    context.on('traverse::end', (event) => {
      for (const script of event.document.querySelectorAll(
        'script:not([src])',
      )) {
        const call = findGeolocationCall(script.textContent ?? '');
        if (call) {
          const source = `${url} (inline script)`;
          found.set(source, { resource: url, source, call, element: script });
        }
      }
    });
    // External scripts are fetched by the connector.
    context.on('fetch::end::script', (event) => {
      const call = findGeolocationCall(event.response.body.content);
      if (call) {
        found.set(event.resource, {
          resource: event.resource,
          source: event.resource,
          call,
        });
      }
    });
    context.on('scan::end', () => {
      for (const { resource, source, call, element } of found.values()) {
        context.report(
          resource,
          `The script ${source} uses the Geolocation API to read the visitor's position.`,
          {
            severity: Severity.warning,
            codeSnippet: call.text,
            codeLanguage: 'javascript',
            // An inline script is located by its element in the page; a
            // fetched script by the line inside the file.
            ...(element
              ? { element }
              : { location: { line: call.line, column: call.column } }),
          },
        );
      }
    });
  },
});
