/**
 * The key a browser subscribes to Web Push with.
 *
 *   GET /api/push/configuration → 200 (401 without a session)
 *
 * The behaviour lives in the push controller; this file only mounts it.
 */

import { pushConfiguration } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

export const { GET } = pushConfiguration.handlers();
