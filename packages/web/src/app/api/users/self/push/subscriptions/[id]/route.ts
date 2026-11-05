/**
 * `DELETE /api/users/self/push/subscriptions/:id`: forget one of the person's Web Push
 * subscriptions. The logic lives in the push controller.
 */

import { subscriptionItem } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

export const { DELETE } = subscriptionItem.handlers();
