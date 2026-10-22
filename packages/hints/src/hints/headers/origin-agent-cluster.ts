import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { originAgentClusterFindings } from '../../lib/headers/reporting-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Origin-Agent-Cluster` asks the browser to isolate the origin into its
 * own agent cluster. The only meaningful value is the structured boolean
 * `?1`; the hint recommends it when absent and reports any other value.
 */
export default defineHint({
  id: 'origin-agent-cluster',
  name: 'Origin-Agent-Cluster requests isolation',
  description:
    'Recommends Origin-Agent-Cluster: ?1 and reports any other value of the header.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin-Agent-Cluster',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'origin-agent-cluster');
      reportFindings(page, originAgentClusterFindings(value), {
        name: 'Origin-Agent-Cluster',
        value,
        suggest: '?1',
      });
    });
  },
});
