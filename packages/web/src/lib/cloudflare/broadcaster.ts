/**
 * @packageDocumentation
 *
 * Tells a person's hub that its fact log grew, so the hub can stream the new
 * facts to the browsers watching it.
 */

import type { UserHub } from './user-hub';
import { errorMessage, logWarn } from '@/utils/logging';

/** The Durable Object namespace holding one hub per person. */
export type HubNamespace = DurableObjectNamespace<UserHub>;

/** Wakes a person's hub after facts were recorded. */
export class Broadcaster {
  /**
   * @param hubs The hub namespace, one object per person id.
   */
  constructor(private readonly hubs: HubNamespace) {}

  /**
   * Wake the person's hub. The facts are already recorded when this runs,
   * so a hub that cannot be reached is logged and never fails the caller.
   *
   * @param userId The person whose log grew.
   */
  async notify(userId: string): Promise<void> {
    try {
      const hub = this.hubs.get(this.hubs.idFromName(userId));
      await hub.notify(userId);
    } catch (error) {
      logWarn({
        event: 'broadcast.failed',
        user_id: userId,
        error: errorMessage(error),
      });
    }
  }
}
