import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { serviceWorkerAllowedFindings } from '../../lib/headersx/service-worker.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Service-Worker-Allowed` widens the maximum scope a service worker may
 * claim. The value is a path or absolute URL; this hint validates it when the
 * header is present, since an invalid scope makes the browser reject the
 * worker registration.
 */
export default defineHint({
  id: 'service-worker-allowed',
  name: 'Service-Worker-Allowed is a valid scope',
  description:
    'Validates that the Service-Worker-Allowed header is a path or absolute URL when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'service-worker-allowed');
      reportFindings(page, serviceWorkerAllowedFindings(value), {
        name: 'Service-Worker-Allowed',
        value,
      });
    });
  },
});
