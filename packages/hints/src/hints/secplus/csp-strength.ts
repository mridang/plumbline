import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { evaluateCspStrength } from '../../lib/secplus/csp-strength.js';
import { headerValues, metaContents } from '../../lib/headers/http-headers.js';
import { reportFindings } from '../headers/shared.js';

/**
 * Content Security Policy depth evaluation (CSP Evaluator style).
 *
 * Distinct from the `csp` hint, which reproduces Mozilla Observatory's
 * pass/fail scoring. This hint evaluates the policy the way Google's CSP
 * Evaluator and web.dev's strict-CSP guidance do: it flags `'unsafe-inline'`
 * without a nonce or hash, `'unsafe-eval'`, a missing `object-src 'none'` or
 * `base-uri`, overly broad allowlists (`*`, `https:`), and whether the policy
 * relies on a host allowlist rather than `'strict-dynamic'`.
 *
 * The policy is parsed once by the shared Observatory CSP parser (reused via
 * `src/lib/secplus/csp-strength.ts`, which calls `parseCsp`); nothing here
 * re-parses CSP. A missing or unparsable policy is left to the `csp` hint.
 *
 * Source: Google CSP Evaluator / web.dev strict CSP.
 */
export default defineHint({
  id: 'csp-strength',
  name: 'Strong Content Security Policy',
  description:
    'Evaluates CSP depth for unsafe-inline, unsafe-eval, object-src, base-uri and broad allowlists.',
  category: Category.security,
  groups: ['google', 'security-headers'],
  reference: 'https://csp-evaluator.withgoogle.com',
  setup(context) {
    onPage(context, (page) => {
      const headers = headerValues(page.headers, 'content-security-policy');
      // A browser also honours a policy in a <meta http-equiv>, so include it
      // when no header policy is present, matching how the `csp` hint reads it.
      const metas =
        headers.length === 0
          ? metaContents(page.document, 'http-equiv', 'content-security-policy')
          : [];
      const findings = evaluateCspStrength([...headers, ...metas]);
      reportFindings(page, findings, {
        name: 'Content-Security-Policy',
        value: [...headers, ...metas],
      });
    });
  },
});
