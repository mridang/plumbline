import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateGpcJson } from '../../lib/wellknown/gpc-json.js';
import { checkFile } from './shared.js';

/**
 * Checks /.well-known/gpc.json against the Global Privacy Control
 * specification. A server publishes this resource to state, in machine
 * readable form, that it honours the GPC signal. It is served as
 * application/json and is an object with a boolean `gpc` and an ISO 8601
 * `lastUpdate` date.
 */
export default defineHint({
  id: 'gpc-json',
  name: 'Valid gpc.json',
  description:
    'Checks that /.well-known/gpc.json follows the Global Privacy Control spec.',
  category: Category.security,
  groups: ['w3c', 'privacy'],
  reference: 'https://privacycg.github.io/gpc-spec/',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/.well-known/gpc.json',
        label: 'gpc.json',
        mediaTypes: ['application/json'],
        // Optional declaration; absence is information, not a fault.
        missing: 'hint',
        example: () =>
          `{\n  "gpc": true,\n  "lastUpdate": "${new Date().toISOString().slice(0, 10)}"\n}\n`,
        validate: (text) => validateGpcJson(text),
      });
    });
  },
});
