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
  category: Category.development,
  groups: ['files', 'agent'],
  reference: 'https://llmstxt.org',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/llms.txt',
        label: 'llms.txt',
        mediaTypes: ['text/plain', 'text/markdown'],
        missing: 'warning',
        example: (origin) =>
          `# ${new URL(origin).hostname}\n\n> One sentence describing the site.\n\n## Docs\n\n- [Home](${origin}/): What the page offers\n`,
        validate: (text) => validateLlmsTxt(text),
      });
    });
  },
});
