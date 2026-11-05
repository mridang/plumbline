/**
 * The GitHub issues Plumbline opened for one of the signed-in person's domains.
 *
 *   GET /api/domains/:id/issues → 200, the issues, newest first
 *
 * The behaviour lives in the `issuesCollection` controller; this file only
 * mounts it.
 */

import { issuesCollection } from '@/domain/api/issues';

export const dynamic = 'force-dynamic';

export const { GET } = issuesCollection.handlers();
