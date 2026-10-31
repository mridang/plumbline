/**
 * The fetches a scan makes through the Worker.
 *
 *   POST /api/scans/{id}/fetches {url, method?, headers?} → 200, the target's
 *   body, with its status and headers in Upstream-* headers
 *
 * The behaviour lives in the `scanFetches` controller; this file only mounts
 * it.
 */

import { scanFetches } from '@/domain/api/scans';

export const dynamic = 'force-dynamic';

export const { POST } = scanFetches.handlers();
