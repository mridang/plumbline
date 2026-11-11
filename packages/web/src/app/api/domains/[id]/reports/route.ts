/**
 * The saved reports of one of the signed-in person's domains.
 *
 *   GET  /api/domains/:id/reports                  → 200, a page of reports
 *   POST /api/domains/:id/reports {url, outcomes}  → 201 + Location.
 *
 * The behaviour lives in the `reportsCollection` controller; this file only
 * mounts it.
 */

import { reportsCollection } from '@/domain/api/reports';

export const dynamic = 'force-dynamic';

export const { GET, POST } = reportsCollection.handlers();
