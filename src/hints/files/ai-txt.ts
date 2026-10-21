import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateAiTxt } from '../../lib/files/ai-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks that /ai.txt is valid in the aitxt.ing or Spawning format.
 * Source: https://llmstxtvalidator.dev
 */
export default defineHint({
  id: 'ai-txt',
  name: 'Valid ai.txt',
  description:
    'Checks that /ai.txt is valid in the aitxt.ing or Spawning format.',
  category: Category.other,
  groups: ['files', 'agent'],
  reference: 'https://llmstxtvalidator.dev',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/ai.txt',
        label: 'ai.txt',
        mediaTypes: ['text/plain', 'text/markdown'],
        missing: 'hint',
        validate: (text) => validateAiTxt(text).issues,
      });
    });
  },
});
