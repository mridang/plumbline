/**
 * The checks of a scan, run in the scanner container.
 *
 *   POST /api/scans/{id}/run → 200, application/x-ndjson: `ready` with the
 *   page and the list of checks, a `done` line per check as it finishes, then
 *   `end`; or `unreachable` when the page did not answer
 *
 * The behaviour lives in the `scanRun` controller; this file only mounts it.
 */

import { scanRun } from '@/domain/api/scans';

export const dynamic = 'force-dynamic';

export const { POST } = scanRun.handlers();
