/**
 * @packageDocumentation
 *
 * What the browser does to receive notifications, apart from drawing anything:
 * whether it can at all, asking permission, subscribing with the key the server
 * gives, telling the server about the subscription, and undoing all of that.
 * Everything the browser provides arrives as a {@link PushHost}, so a test can
 * stand in for it.
 */

import { problemError } from '@/components/api/problem-message';
import { WORKER_URL } from '@/components/site/service-worker';
import { isIosSafari } from '@/components/site/ios-install';
import { subscriptionId } from '@/lib/push/subscription-id';

/** Whether this browser can receive notifications, and if not, what would let it. */
export type PushSupport =
  | 'supported'
  /** Safari on iPhone and iPad only does push once the app is on the Home Screen. */
  | 'needs-install'
  | 'unsupported';

/** What the page can tell about the browser. */
export interface PushCapabilities {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Running as an installed app. */
  readonly standalone: boolean;
  readonly hasServiceWorker: boolean;
  readonly hasPushManager: boolean;
  readonly hasNotification: boolean;
}

/** Decide whether push can work here. */
export function pushSupport(caps: PushCapabilities): PushSupport {
  if (caps.hasServiceWorker && caps.hasPushManager && caps.hasNotification) {
    return 'supported';
  }
  return isIosSafari(caps.userAgent, caps.maxTouchPoints) && !caps.standalone
    ? 'needs-install'
    : 'unsupported';
}

/** The `applicationServerKey` bytes for a base64url VAPID public key. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** The part of a browser subscription the page uses. */
export interface BrowserSubscription {
  readonly endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

/** The parts of the browser notifications need. */
export interface PushHost {
  /** The worker's push manager once the worker is ready. */
  readonly manager: () => Promise<{
    getSubscription(): Promise<BrowserSubscription | null>;
    subscribe(options: {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array<ArrayBuffer>;
    }): Promise<BrowserSubscription>;
  }>;
  readonly permission: () => NotificationPermission;
  readonly requestPermission: () => Promise<NotificationPermission>;
  readonly fetcher: typeof fetch;
}

/** Why turning notifications on did not work, in words for the person. */
export class PushError extends Error {
  override readonly name = 'PushError';
}

/** Read the server's answer, or throw its refusal. */
async function checked(response: Response): Promise<Response> {
  if (response.status === 401 && globalThis.window !== undefined) {
    globalThis.location.assign('/login');
  }
  if (!response.ok) {
    throw await problemError(response);
  }
  return response;
}

/** The address of one of the person's subscriptions. */
async function addressOf(subscription: BrowserSubscription): Promise<string> {
  return `/api/users/self/push/subscriptions/${await subscriptionId(subscription.endpoint)}`;
}

/** A subscription as the API takes it: its address and keys. */
export function wireOf(subscription: BrowserSubscription): {
  endpoint: unknown;
  keys: unknown;
} {
  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: unknown;
    keys: unknown;
  };
  return { endpoint, keys };
}

/** The browser's current subscription, if it has one. */
export async function currentSubscription(
  host: PushHost,
): Promise<BrowserSubscription | null> {
  return (await host.manager()).getSubscription();
}

/**
 * Turn notifications on for this browser: ask permission, subscribe with the
 * server's key and register the subscription for the signed-in person.
 * @throws {@link PushError} When permission is refused.
 */
export async function enablePush(host: PushHost): Promise<BrowserSubscription> {
  const permission =
    host.permission() === 'default'
      ? await host.requestPermission()
      : host.permission();
  if (permission !== 'granted') {
    throw new PushError(
      'Notifications are blocked for this site. Allow them in the browser settings, then try again.',
    );
  }
  const manager = await host.manager();
  const existing = await manager.getSubscription();
  const subscription =
    existing ??
    (await manager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(
        (
          (await (
            await checked(
              await host.fetcher('/api/push/configuration', {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
              }),
            )
          ).json()) as { vapid_public_key: string }
        ).vapid_public_key,
      ),
    }));
  await checked(
    await host.fetcher('/api/users/self/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      // Only what the API takes: a browser's own JSON also carries a
      // camel-cased `expirationTime`.
      body: JSON.stringify(wireOf(subscription)),
    }),
  );
  return subscription;
}

/** Turn notifications off for this browser: forget the subscription on the server, then in the browser. */
export async function disablePush(host: PushHost): Promise<void> {
  const subscription = await currentSubscription(host);
  if (subscription === null) {
    return;
  }
  const response = await host.fetcher(await addressOf(subscription), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (response.status !== 404) {
    await checked(response);
  }
  await subscription.unsubscribe();
}

/**
 * Send this browser a test notification.
 * @throws {@link PushError} When this browser has no subscription.
 */
export async function sendTest(host: PushHost): Promise<void> {
  const subscription = await currentSubscription(host);
  if (subscription === null) {
    throw new PushError('Turn notifications on first.');
  }
  await checked(
    await host.fetcher(`${await addressOf(subscription)}/tests`, {
      method: 'POST',
      credentials: 'same-origin',
    }),
  );
}

/** The live browser. */
export function browserHost(): PushHost {
  return {
    manager: async () => {
      // Development registers no worker, and `ready` would then never settle.
      if (!(await navigator.serviceWorker.getRegistration())) {
        await navigator.serviceWorker.register(WORKER_URL, { scope: '/' });
      }
      return (await navigator.serviceWorker.ready).pushManager;
    },
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    fetcher: (input, init) => fetch(input, init),
  };
}

/** What the live browser can do. */
export function browserCapabilities(): PushCapabilities {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      (navigator as { standalone?: boolean }).standalone === true ||
      globalThis.matchMedia('(display-mode: standalone)').matches,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in globalThis,
    hasNotification: 'Notification' in globalThis,
  };
}
