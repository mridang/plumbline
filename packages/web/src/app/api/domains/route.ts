/**
 * The domains the signed-in person keeps an eye on.
 *
 *   GET  /api/domains        → 200, a page of domains
 *   POST /api/domains {host} → 201 + Location (200 + Location when they
 *                              already have it)
 *
 * The behaviour lives in the `domainsCollection` controller; this file only
 * mounts it.
 */

import { domainsCollection } from '@/domain/api/domains';

export const dynamic = 'force-dynamic';

export const { GET, POST } = domainsCollection.handlers();
