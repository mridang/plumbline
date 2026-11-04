/**
 * @packageDocumentation
 *
 * D1-backed store of Web Push subscriptions. A subscription belongs to a
 * person (`user_id`): they opt in on each device by subscribing, and only they
 * can list or remove it. Subscriptions are inserted on subscribe, deleted on
 * 404/410 or when the person turns notifications off, and found by person when
 * one of their sites changes.
 */

import { eq } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { pushSubscriptions } from '@/domain/db/schema';
import type {
  PushSubscriptionRecord,
  PushSubscriptionStore,
} from '@/lib/push/types';

/** A subscription and the person it belongs to. */
export interface OwnedSubscription extends PushSubscriptionRecord {
  readonly user_id: number;
}

/** D1-backed {@link PushSubscriptionStore}: operations over `push_subscriptions`. */
export class PushSubscriptionRepository implements PushSubscriptionStore {
  constructor(private readonly db: Database) {
    //
  }

  /**
   * Upsert a subscription keyed by `endpoint`. Browsers may reissue the same
   * `endpoint` with rotated keys, and a device may change hands (someone else
   * signs in on it), so the row is replaced on conflict.
   */
  async upsert(record: OwnedSubscription, nowIso: string): Promise<void> {
    const mutable = {
      user_id: record.user_id,
      p256dh: record.p256dh,
      auth: record.auth,
    };
    await this.db
      .insert(pushSubscriptions)
      .values({ endpoint: record.endpoint, ...mutable, created_at: nowIso })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: mutable });
  }

  /** Read every active subscription. */
  async listAll(): Promise<readonly PushSubscriptionRecord[]> {
    return this.db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions);
  }

  /** Read the subscriptions of one person (an index lookup, not a table read). */
  async listForUser(userId: number): Promise<readonly OwnedSubscription[]> {
    return this.db
      .select({
        endpoint: pushSubscriptions.endpoint,
        user_id: pushSubscriptions.user_id,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.user_id, userId));
  }

  /** Drop the row keyed by `endpoint`. Idempotent. */
  async remove(endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Stamp the most-recent send time for a subscription. */
  async markSent(endpoint: string, nowIso: string): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ last_sent_at: nowIso })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
