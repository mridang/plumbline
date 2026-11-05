/**
 * @packageDocumentation
 *
 * The Web Push endpoints, all for the signed-in person: the key at
 * `/api/push/configuration` and the person's own subscriptions under
 * `/api/users/self/push/subscriptions`. They read
 * the key a browser subscribes with, register and forget the browser's
 * subscription (a subscription belongs to whoever registered it, and nobody
 * else can see, test or remove it), and send a test notification to one.
 */

import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { getDatabase } from '@/domain/db/client';
import {
  PushSubscriptionRepository,
  type OwnedSubscription,
} from '@/domain/push/repository';
import {
  ApiController,
  created,
  noContent,
  ok,
  problem,
  problems,
  readJsonObject,
} from '@/lib/core/api';
import type { RouteContext } from '@/lib/core/api/route-context';
import { getEnv } from '@/lib/core/runtime';
import { PushNotifier, WebPushSender } from '@/lib/push';
import {
  endpointForId,
  isSubscriptionId,
  subscriptionId,
} from '@/lib/push/subscription-id';

/** The signed-in caller and the subscription the path names, if it names one. */
interface PushContext {
  readonly uid: number;
  readonly id: string | undefined;
}

/** A browser `PushSubscription` that has been checked. */
interface CheckedSubscription {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** Check the JSON of a browser `PushSubscription`, or the messages for what was wrong. */
function checkSubscription(
  body: Readonly<Record<string, unknown>>,
): CheckedSubscription | readonly string[] {
  const { endpoint, keys } = body;
  const { p256dh, auth } = (keys ?? {}) as Readonly<Record<string, unknown>>;
  const errors: string[] = [];
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
    errors.push('endpoint: must be an https URL.');
  }
  if (typeof p256dh !== 'string' || !p256dh) {
    errors.push('keys.p256dh: required.');
  }
  if (typeof auth !== 'string' || !auth) {
    errors.push('keys.auth: required.');
  }
  return errors.length > 0
    ? errors
    : {
        endpoint: endpoint as string,
        p256dh: p256dh as string,
        auth: auth as string,
      };
}

/**
 * The person's own subscription named by the `{id}` of the path.
 *
 * @throws The 404 problem for an id that is not a subscription of theirs.
 */
async function ownSubscription(
  context: Readonly<PushContext>,
): Promise<OwnedSubscription> {
  if (!context.id || !isSubscriptionId(context.id)) {
    throw problems.notFound('push subscription');
  }
  const own = await new PushSubscriptionRepository(getDatabase()).listForUser(
    context.uid,
  );
  const endpoint = await endpointForId(
    own.map((subscription) => subscription.endpoint),
    context.id,
  );
  const found = own.find((subscription) => subscription.endpoint === endpoint);
  if (!found) {
    throw problems.notFound('push subscription');
  }
  return found;
}

/** The context of a request: who is signed in, and the `{id}` of the path. */
function contextOf(
  resolver: CurrentUserResolver,
): (request: Request, route: RouteContext) => Promise<PushContext> {
  return async (request, route) => ({
    uid: await liveUid(request, resolver),
    id: (await route.params)?.['id'],
  });
}

/** `GET /api/push/configuration`: the VAPID public key a browser subscribes with. 200, 401 without a session. */
export function createPushConfiguration(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<PushContext> {
  return new ApiController<PushContext>({
    context: contextOf(resolver),
  }).on<null, { readonly vapid_public_key: string }>({
    method: 'GET',
    handle: () => ({ vapid_public_key: getEnv().VAPID_PUBLIC_KEY }),
    encode: (body) =>
      ok(body, { headers: { 'Cache-Control': 'private, max-age=3600' } }),
  });
}

/**
 * `POST /api/users/self/push/subscriptions`: register the browser's Web Push subscription
 * for the signed-in person. A repeated call for the same `endpoint` replaces the
 * keys (browsers rotate them) and the owner (a device can change hands). 201
 * with a `Location` for a new subscription, 200 for one already registered, 400
 * for a body that is not a subscription, 401 without a session, 403 cross-site.
 */
export function createSubscriptionsCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<PushContext> {
  return new ApiController<PushContext>({
    context: contextOf(resolver),
  }).on<
    CheckedSubscription,
    { readonly id: string; readonly existed: boolean }
  >({
    method: 'POST',
    decode: async (request) => {
      const body = await readJsonObject(
        request,
        'The body must be a push subscription object.',
      );
      if (!body.ok) {
        throw body.response;
      }
      const checked = checkSubscription(body.value);
      if (Array.isArray(checked)) {
        throw problems.badRequest('The subscription is not valid.', checked);
      }
      return checked as CheckedSubscription;
    },
    handle: async (subscription, { uid }) => {
      const repository = new PushSubscriptionRepository(getDatabase());
      const existed = (await repository.listForUser(uid)).some(
        (known) => known.endpoint === subscription.endpoint,
      );
      await repository.upsert(
        { ...subscription, user_id: uid },
        new Date().toISOString(),
      );
      return { id: await subscriptionId(subscription.endpoint), existed };
    },
    encode: (result) => {
      const location = `/api/users/self/push/subscriptions/${result.id}`;
      return result.existed
        ? ok({ id: result.id }, { location })
        : created({ id: result.id }, location);
    },
  });
}

/**
 * `DELETE /api/users/self/push/subscriptions/{id}`: forget one of the person's Web Push
 * subscriptions. 204, 401 without a session, 403 cross-site, 404 when there is
 * no such subscription of theirs.
 */
export function createSubscriptionItem(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<PushContext> {
  return new ApiController<PushContext>({
    context: contextOf(resolver),
  }).on<null, undefined>({
    method: 'DELETE',
    handle: async (_input, context) => {
      const found = await ownSubscription(context);
      await new PushSubscriptionRepository(getDatabase()).remove(
        found.endpoint,
      );
      return undefined;
    },
    encode: () => noContent(),
  });
}

/** The notifier for this Worker's VAPID keys, or null when it has none. */
function notifierOf(): PushNotifier | null {
  const env = getEnv();
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new PushNotifier(
        new WebPushSender(
          {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT,
          },
          { fetcher: (input, init) => fetch(input, init) },
        ),
        new PushSubscriptionRepository(getDatabase()),
      )
    : null;
}

/**
 * `POST /api/users/self/push/subscriptions/{id}/tests`: send a test notification to one of
 * the person's subscriptions. 204 when the push service took it, 401 without a
 * session, 403 cross-site, 404 when there is no such subscription of theirs
 * (also when the push service says it is gone, and it is forgotten), 502 when
 * the push service refused it, 503 when the Worker has no VAPID keys.
 */
export function createSubscriptionTests(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<PushContext> {
  return new ApiController<PushContext>({
    context: contextOf(resolver),
  }).on<null, undefined>({
    method: 'POST',
    handle: async (_input, context) => {
      const notifier = notifierOf();
      if (notifier === null) {
        throw problem(
          503,
          '/problems/not-configured',
          'Notifications are not configured',
          'This Worker has no VAPID keys.',
        );
      }
      const found = await ownSubscription(context);
      const outcome = await notifier.deliver(found, {
        title: 'Notifications are on',
        body: 'This is a test from Plumbline. You will hear about your sites here.',
        url: '/dashboard',
        tag: 'test',
      });
      if (outcome.pruned) {
        throw problems.notFound('push subscription');
      }
      if (!outcome.delivered) {
        throw problem(
          502,
          '/problems/upstream-failure',
          'The push service refused the notification',
          'Try turning notifications off and on again.',
        );
      }
      return undefined;
    },
    encode: () => noContent(),
  });
}

/** The configuration controller bound to production. */
export const pushConfiguration = createPushConfiguration();

/** The subscriptions collection controller bound to production. */
export const subscriptionsCollection = createSubscriptionsCollection();

/** The subscription item controller bound to production. */
export const subscriptionItem = createSubscriptionItem();

/** The test-notification controller bound to production. */
export const subscriptionTests = createSubscriptionTests();
