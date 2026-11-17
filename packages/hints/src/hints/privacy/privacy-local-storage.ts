import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { parseStorage, truncate } from '../../lib/privacy/local-storage.js';

/**
 * Webbkoll, "localStorage": reports whether the page stores data in
 * `localStorage`, listing keys and values cut to 50 characters. Like cookies,
 * persistent web storage can be used to recognise and profile visitors
 * (GDPR: same as for cookies). The storage is read in the browser through
 * `context.evaluate`; where no browser is available nothing is reported.
 */
export default defineHint({
  id: 'privacy-local-storage',
  name: 'localStorage',
  description: 'Reports data the page stores in localStorage.',
  category: Category.security,
  groups: ['webbkoll', 'privacy'],
  reference: 'https://html.spec.whatwg.org/multipage/webstorage.html',
  setup(context) {
    // eslint-disable-next-line functional/no-let -- captured by the scan::start handler and read by the later handlers
    let url = '';
    context.on('scan::start', (event) => {
      url = event.resource;
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- webhint's context.on types its listener as returning void, but the engine awaits it; dropping the async would stop the scan waiting for this handler
    context.on('scan::end', async () => {
      const entries = await context
        .evaluate('JSON.stringify(Object.assign({}, localStorage))')
        .then((stored: unknown) => parseStorage(stored))
        .catch(() => null);
      if (!entries || entries.length === 0) {
        return;
      }
      const list = entries
        .map((entry) => `${truncate(entry.key)} = ${truncate(entry.value)}`)
        .join('; ');
      context.report(url, `localStorage used (${entries.length}): ${list}`, {
        severity: Severity.hint,
        codeSnippet: entries.map((entry) => truncate(entry.key)).join('\n'),
      });
    });
  },
});
