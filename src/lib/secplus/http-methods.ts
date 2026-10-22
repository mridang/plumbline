/**
 * Allowed HTTP methods on the site root.
 *
 * An `OPTIONS` request advertises the methods a resource accepts in its
 * `Allow` response header. Two things there are worth flagging:
 *
 *   - `TRACE` (and the IIS-specific `TRACK`) enable Cross-Site Tracing (XST),
 *     which can echo back headers — including cookies — and defeat HttpOnly.
 *     OWASP advises disabling it everywhere.
 *   - Write methods (`PUT`, `DELETE`, `PATCH`, `CONNECT`) on the root are
 *     rarely intended on a public site and usually point at a misconfigured
 *     WebDAV or proxy. They are reported as advice, not a hard failure, since
 *     a legitimate API may expose them.
 *
 * Reference: OWASP Testing Guide — Test HTTP Methods
 * (https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods).
 */
import { finding, type Finding } from '../headers/finding.js';

/** Methods that enable Cross-Site Tracing and should never be enabled. */
const DANGEROUS_METHODS = new Set(['TRACE', 'TRACK']);

/** Write methods that are suspicious on the root of a public site. */
const UNSAFE_METHODS = new Set(['PUT', 'DELETE', 'PATCH', 'CONNECT']);

/**
 * Parses an `Allow` (or `Access-Control-Allow-Methods`) header into its
 * upper-cased method tokens. Returns an empty list for a null or empty header.
 */
export function parseAllowedMethods(allow: string | null): string[] {
  if (!allow) {
    return [];
  }
  return allow
    .split(',')
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method !== '');
}

/** Findings for the set of methods the root advertises. */
export function httpMethodsFindings(allowed: readonly string[]): Finding[] {
  const methods = new Set(allowed.map((method) => method.toUpperCase()));
  const findings: Finding[] = [];

  for (const method of DANGEROUS_METHODS) {
    if (methods.has(method)) {
      findings.push(
        finding(
          'error',
          `The ${method} method is enabled on the site root; it enables Cross-Site Tracing (XST) and can expose HttpOnly cookies. Disable ${method}.`,
        ),
      );
    }
  }

  const unsafe = [...UNSAFE_METHODS].filter((method) => methods.has(method));
  if (unsafe.length > 0) {
    findings.push(
      finding(
        'warning',
        `The site root allows the write method(s) ${unsafe.join(', ')}; unless this is an intended API, restrict the methods the server accepts.`,
      ),
    );
  }

  return findings;
}
