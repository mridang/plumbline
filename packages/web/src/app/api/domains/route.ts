/**
 * The domains the signed-in person keeps an eye on.
 *
 *   GET  /api/domains        → 200, a page of domains
 *
 * The behaviour lives in the `domainsCollection` controller; this file only
 * mounts it.
 */

import { domainsCollection } from '@/domain/api/domains';

export const dynamic = 'force-dynamic';

export const { GET } = domainsCollection.handlers();
