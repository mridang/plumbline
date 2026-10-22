/**
 * Cross-origin resource sharing, a port of Mozilla Observatory's
 * `tests/cors.js`. The site is asked for a page with an `Origin` header and
 * the `Access-Control-Allow-Origin` answer is classified:
 *
 * - absent: not implemented
 * - `*`: public access
 * - echoes the requesting origin and allows credentials: universal access,
 *   which exposes the site to CSRF-style attacks
 * - anything else: restricted to specific origins
 */
import { finding, type Finding } from './finding.js';

/** The origin the probe pretends to be. */
export const PROBE_ORIGIN = 'https://http-observatory.security.mozilla.org';

export type CorsResult =
  'not-implemented' | 'public' | 'restricted' | 'universal';

export interface CorsInput {
  allowOrigin: string | null;
  allowCredentials: string | null;
  /** The `Origin` the request was sent with. */
  origin: string;
}

export function analyzeCors({
  allowOrigin,
  allowCredentials,
  origin,
}: CorsInput): CorsResult {
  if (!allowOrigin) {
    return 'not-implemented';
  }
  const acao = allowOrigin.slice(0, 256).trim().toLowerCase();
  if (acao === '*') {
    return 'public';
  }
  if (
    origin === allowOrigin &&
    allowCredentials?.trim().toLowerCase() === 'true'
  ) {
    return 'universal';
  }
  return 'restricted';
}

export function corsFindings(input: CorsInput): Finding[] {
  switch (analyzeCors(input)) {
    case 'universal':
      return [
        finding(
          'error',
          'Content is visible via cross-origin resource sharing (CORS) file or headers, and credentials can be sent. Your site could be vulnerable to CSRF attacks. If credentialed access is required from specific origins, ensure Access-Control-Allow-Origin can only be set to those origins, rather than reflecting the Origin header. If public non-credentialed access is required, set Access-Control-Allow-Origin to * and omit the Access-Control-Allow-Credentials header. Otherwise, omit both headers.',
        ),
      ];
    case 'public':
      return [
        finding(
          'hint',
          'Public content is visible via cross-origin resource sharing (CORS) Access-Control-Allow-Origin header.',
        ),
      ];
    default:
      return [];
  }
}
