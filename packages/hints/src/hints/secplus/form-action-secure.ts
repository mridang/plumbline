import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  formActionFinding,
  type FormLike,
} from '../../lib/secplus/form-action.js';
import { reportElementFinding } from './shared.js';

/**
 * Insecure form submission (mixed form action).
 *
 * Flags every `<form>` on an HTTPS page whose `action` resolves to an
 * `http://` URL: the submitted data would travel in clear text and the browser
 * interrupts the user with an insecure-form warning. The rule, message and
 * severity live in `src/lib/secplus/form-action.ts`; this hint walks the DOM
 * and attaches the offending form to each report.
 *
 * Source: browser mixed-content form behaviour / MDN insecure forms.
 */
export default defineHint({
  id: 'form-action-secure',
  name: 'Secure form action',
  description:
    'Checks that forms on an HTTPS page do not submit to an http:// action.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Insecure_passwords#insecure_forms',
  setup(context) {
    onPage(context, (page) => {
      const forms = [...page.document.querySelectorAll('form[action]')];
      for (const element of forms) {
        const form: FormLike = { action: element.getAttribute('action') };
        const found = formActionFinding(form, page.url);
        if (found) {
          reportElementFinding(page, found, element);
        }
      }
    });
  },
});
