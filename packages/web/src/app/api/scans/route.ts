/**
 * The scans.
 *
 *   POST /api/scans {url} → 201 + Location {id, url, expires_at}
 *
 * The behaviour lives in the `scansCollection` controller; this file only
 * mounts it.
 */

import { scansCollection } from '@/domain/api/scans';

export const dynamic = 'force-dynamic';

export const { POST } = scansCollection.handlers();
