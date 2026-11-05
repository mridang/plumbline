/**
 * One run of a domain, with every check's outcome.
 *
 *   GET /api/domains/:id/runs/:run_id → 200
 *
 * The behaviour lives in the `runItem` controller; this file only mounts it.
 */

import { runItem } from '@/domain/api/runs';

export const dynamic = 'force-dynamic';

export const { GET } = runItem.handlers();
