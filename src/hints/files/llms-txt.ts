import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateLlmsTxt } from '../../lib/files/llms-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks that /llms.txt follows the llmstxt.org format.
 * Source: https://llmstxt.org
 */
export default defineHint({
  id: 'llms-txt',
  name: 'Valid llms.txt',
  description: 'Checks that /llms.txt follows the llmstxt.org format.',
  category: Category.other,
  groups: ['files', 'agent'],
  reference: 'https://llmstxt.org',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/llms.txt',
        label: 'llms.txt',
        mediaTypes: ['text/plain', 'text/markdown'],
        missing: 'warning',
        validate: (text) => validateLlmsTxt(text),
      });
    });
  },
});
