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
    let url = '';
    context.on('scan::start', (event) => {
      url = event.resource;
    });
    context.on('scan::end', async () => {
      let entries;
      try {
        entries = parseStorage(
          await context.evaluate(
            'JSON.stringify(Object.assign({}, localStorage))',
          ),
        );
      } catch {
        return;
      }
      if (entries.length === 0) {
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
