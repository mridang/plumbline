/**
 * `POST /api/push/subscriptions/:id/tests`: send a test notification to one of
 * the person's subscriptions. The logic lives in the push controller.
 */

import { subscriptionTests } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

export const { POST } = subscriptionTests.handlers();
