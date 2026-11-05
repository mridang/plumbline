/**
 * The run history of one of the signed-in person's domains.
 *
 *   GET /api/domains/:id/runs → 200, a page of runs, newest first
 *
 * The behaviour lives in the `runsCollection` controller; this file only
 * mounts it.
 */

import { runsCollection } from '@/domain/api/runs';

export const dynamic = 'force-dynamic';

export const { GET } = runsCollection.handlers();
