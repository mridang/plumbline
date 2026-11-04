/**
 * @packageDocumentation
 *
 * Tells the person what their checks are doing, as it happens: a check began,
 * a check ended, and (when something changed that matters) a push notification.
 * Everything here is best effort: a hub or a push service that cannot be
 * reached is logged and never fails the check it reports on.
 */

import type { Database } from '@/domain/db/client';
import {
  appendEvent,
  markChecked,
  markChecking,
  type Counts,
} from '@/domain/db/live';
import { describeChange } from '@/domain/live/changes';
import { PushSubscriptionRepository } from '@/domain/push/repository';
import { Broadcaster, type HubNamespace } from '@/lib/cloudflare/broadcaster';
import { PushNotifier, WebPushSender } from '@/lib/push';
import { errorMessage, logWarn } from '@/utils/logging';

/** A site as the dashboard names it. */
export interface LiveSite {
  readonly host: string;
  readonly repo: string | null;
}

/** What the checks report to; the real one tells the dashboard and subscribers. */
export interface Live {
  /** A check of the site began. */
  started(userId: number, site: LiveSite, at: string): Promise<void>;
  /** A check ended: `after` is null when the site did not answer. */
  finished(
    userId: number,
    site: LiveSite,
    change: Readonly<{
      before: Counts | null;
      after: Counts | null;
      at: string;
    }>,
  ): Promise<void>;
}

/** The settings the real {@link Live} reads. */
export interface LiveEnv {
  readonly USER_HUB?: unknown;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly VAPID_SUBJECT?: string;
}

/** Run `work`, logging instead of throwing. */
async function quietly(
  event: string,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    logWarn({ event, error: errorMessage(error) });
  }
}

/** The real {@link Live}: stores the event, wakes the person's hub, sends the push. */
export function createLive(db: Database, env: Readonly<LiveEnv>): Live {
  const broadcaster = env.USER_HUB
    ? new Broadcaster(env.USER_HUB as HubNamespace)
    : null;
  const subscriptions = new PushSubscriptionRepository(db);
  const notifier =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new PushNotifier(
          new WebPushSender(
            {
              publicKey: env.VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY,
              subject: env.VAPID_SUBJECT,
            },
            { fetcher: (input, init) => fetch(input, init) },
          ),
          subscriptions,
        )
      : null;

  /** Store `event` and wake the hub so open dashboards show it. */
  const publish = async (userId: number, event: unknown, at: string) => {
    await appendEvent(db, userId, event, at);
    await broadcaster?.notify(String(userId));
  };

  return {
    async started(userId, site, at) {
      await quietly('live.started', async () => {
        await markChecking(db, userId, site.host, at);
        await publish(userId, { type: 'started', ...site, at }, at);
      });
    },
    async finished(userId, site, { before, after, at }) {
      await quietly('live.finished', async () => {
        await markChecked(db, userId, site.host, { counts: after, at });
        await publish(
          userId,
          {
            type: 'finished',
            ...site,
            reachable: after !== null,
            ...(after ?? {}),
            at,
          },
          at,
        );
      });
      const message = describeChange(site.host, before, after);
      if (message && notifier) {
        await quietly('live.push', async () => {
          for (const subscription of await subscriptions.listForUser(userId)) {
            await notifier.deliver(subscription, {
              ...message,
              tag: site.host,
              url: '/dashboard',
            });
          }
        });
      }
    },
  };
}
