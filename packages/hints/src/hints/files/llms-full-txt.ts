import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateLlmsFullTxt } from '../../lib/files/llms-full-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks that /llms-full.txt is non-empty markdown that parses.
 * Source: https://llmstxt.org.
 */
export default defineHint({
  id: 'llms-full-txt',
  name: 'Valid llms-full.txt',
  description: 'Checks that /llms-full.txt is non-empty markdown that parses.',
  category: Category.development,
  groups: ['files', 'agent'],
  reference: 'https://llmstxt.org',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/llms-full.txt',
        label: 'llms-full.txt',
        mediaTypes: ['text/plain', 'text/markdown'],
        missing: 'hint',
        example: (origin) =>
          `# ${new URL(origin).hostname}\n\n> One sentence describing the site.\n\n## Docs\n\nThe full text of the documentation goes here.\n`,
        validate: (text) => validateLlmsFullTxt(text),
      });
    });
  },
});
