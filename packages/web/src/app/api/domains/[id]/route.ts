/**
 * One of the signed-in person's domains, with the checks chosen for it.
 *
 *   GET    /api/domains/:id          → 200 + ETag
 *   PATCH  /api/domains/:id {checks} → 200 + ETag (honours If-Match)
 *   DELETE /api/domains/:id          → 204
 *
 * The behaviour lives in the `domainItem` controller; this file only mounts it.
 */

import { domainItem } from '@/domain/api/domains';

export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = domainItem.handlers();
