import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { checkFile } from './shared.js';

/**
 * Checks /humans.txt, the humanstxt.org convention for crediting the people
 * behind a site. There is no formal schema: the only requirements are that
 * the file exists at the web root and is served as text/plain. This is
 * informational, so a missing file is reported at hint severity.
 */
export default defineHint({
  id: 'humans-txt',
  name: 'humans.txt present',
  description:
    'Checks that /humans.txt is present and served as plain text (humanstxt.org).',
  category: Category.development,
  groups: ['indieweb', 'seo'],
  reference: 'https://humanstxt.org/',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/humans.txt',
        label: 'humans.txt',
        mediaTypes: ['text/plain'],
        // Purely a nicety, so its absence is information only.
        missing: 'hint',
        example: () =>
          '/* TEAM */\nDeveloper: Your Name\nSite: you@example.com\n',
        // humans.txt has free-form content; nothing to validate in the body.
        validate: () => [],
      });
    });
  },
});
