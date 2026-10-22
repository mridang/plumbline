import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { speculationRulesFindings } from '../../lib/headersx/speculation.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Speculation-Rules` points the browser at an external JSON speculation-
 * rules document, as a structured list of quoted ruleset URLs. This hint
 * validates that every member is a quoted non-empty URL when the header is
 * present.
 */
export default defineHint({
  id: 'speculation-rules',
  name: 'Speculation-Rules points to a ruleset',
  description:
    'Validates that the Speculation-Rules header lists quoted ruleset URLs when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Speculation-Rules',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'speculation-rules');
      reportFindings(page, speculationRulesFindings(value), {
        name: 'Speculation-Rules',
        value,
      });
    });
  },
});
