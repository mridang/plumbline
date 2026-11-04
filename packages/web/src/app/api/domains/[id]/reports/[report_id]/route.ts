/**
 * One saved report, with every check's outcome.
 *
 *   GET /api/domains/:id/reports/:report_id → 200
 *
 * The behaviour lives in the `reportItem` controller; this file only mounts it.
 */

import { reportItem } from '@/domain/api/reports';

export const dynamic = 'force-dynamic';

export const { GET } = reportItem.handlers();
