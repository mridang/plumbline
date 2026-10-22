/**
 * `Service-Worker-Allowed` widens the maximum scope a service worker may claim
 * beyond the path it is served from. The value is a URL (usually a path) that
 * becomes the worker's allowed scope. The check validates it when present,
 * following the MDN reference page.
 */
import { finding, type Finding } from '../headers/finding.js';

/**
 * `Service-Worker-Allowed` must be a path or absolute URL. A value that is
 * neither a path beginning with `/` nor a parseable absolute URL is reported,
 * because the browser then rejects the worker registration with a scope error.
 */
export function serviceWorkerAllowedFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const scope = value.trim();
  if (scope === '') {
    return [
      finding('warning', "The 'Service-Worker-Allowed' header is empty."),
    ];
  }
  if (scope.startsWith('/')) {
    return [];
  }
  try {
    // An absolute URL is also a valid scope; a relative one without a leading
    // slash is ambiguous and the browser does not accept it.
    void new URL(scope);
    return [];
  } catch {
    return [
      finding(
        'warning',
        `The 'Service-Worker-Allowed' header must be a path starting with '/' or an absolute URL, not '${value}'.`,
      ),
    ];
  }
}
