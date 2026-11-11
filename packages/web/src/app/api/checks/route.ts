/**
 * Every check plumbline can run.
 *
 *   GET /api/checks[?group=tls] → 200, a page of checks.
 *
 * The behaviour lives in the `checksCollection` controller; this file only
 * mounts it.
 */

import { checksCollection } from '@/domain/api/checks';

export const { GET } = checksCollection.handlers();
