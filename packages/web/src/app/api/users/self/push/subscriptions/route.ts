/**
 * `POST /api/users/self/push/subscriptions`: register the browser's Web Push subscription.
 * The logic lives in the push controller; this file only mounts it.
 */

import { subscriptionsCollection } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

export const { POST } = subscriptionsCollection.handlers();
