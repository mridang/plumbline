import { describe, expect, it, jest } from '@jest/globals';

import {
  browserCapabilities,
  browserHost,
  disablePush,
  enablePush,
  keyBytes,
  PushError,
  pushSupport,
  sendTest,
  type BrowserSubscription,
  type PushCapabilities,
  type PushHost,
} from '@/components/notifications/push-client';
import { subscriptionId } from '@/lib/push/subscription-id';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const caps = (overrides: Partial<PushCapabilities> = {}): PushCapabilities => ({
  userAgent: 'Mozilla/5.0 Chrome',
  maxTouchPoints: 0,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  ...overrides,
});

describe('pushSupport', () => {
  it('is supported where the worker, push and notifications all exist', () => {
    expect(pushSupport(caps())).toBe('supported');
  });

  it('asks Safari on iPhone to install the app first', () => {
    expect(
      pushSupport(
        caps({ userAgent: IPHONE, maxTouchPoints: 5, hasPushManager: false }),
      ),
    ).toBe('needs-install');
  });

  it('is unsupported in a browser that simply cannot', () => {
    expect(pushSupport(caps({ hasPushManager: false }))).toBe('unsupported');
  });

  it('does not ask an installed iPhone app to install itself again', () => {
    expect(
      pushSupport(
        caps({
          userAgent: IPHONE,
          maxTouchPoints: 5,
          hasPushManager: false,
          standalone: true,
        }),
      ),
    ).toBe('unsupported');
  });
});

describe('keyBytes', () => {
  it('decodes base64url, with or without padding', () => {
    expect([...keyBytes('-_8')]).toEqual([251, 255]);
    expect([...keyBytes('AQID')]).toEqual([1, 2, 3]);
  });
});

const ENDPOINT = 'https://push.test/abc';

function browser(options: {
  permission?: NotificationPermission;
  asked?: NotificationPermission;
  existing?: boolean;
  responses?: Record<string, number>;
}) {
  const subscription: BrowserSubscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: jest.fn(async () => true),
  };
  const subscribe = jest.fn<(options: unknown) => Promise<BrowserSubscription>>(
    async () => subscription,
  );
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const host: PushHost = {
    manager: async () => ({
      getSubscription: async () => (options.existing ? subscription : null),
      subscribe,
    }),
    permission: () => options.permission ?? 'default',
    requestPermission: async () => options.asked ?? 'granted',
    fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
      const status =
        options.responses?.[`${init?.method ?? 'GET'} ${url}`] ?? 200;
      return url.endsWith('configuration')
        ? Response.json({ vapid_public_key: 'AQID' })
        : new Response(status === 204 ? null : '{}', { status });
    }) as typeof fetch,
  };
  return { host, subscription, subscribe, calls };
}

describe('enablePush', () => {
  it('asks permission, subscribes with the server’s key and registers the subscription', async () => {
    const { host, subscribe, calls } = browser({});
    await enablePush(host);
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /api/push/configuration',
      'POST /api/push/subscriptions',
    ]);
    expect(JSON.parse(String(calls[1]?.body))).toEqual({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p', auth: 'a' },
    });
  });

  it('reuses a subscription the browser already has', async () => {
    const { host, subscribe, calls } = browser({
      permission: 'granted',
      existing: true,
    });
    await enablePush(host);
    expect(subscribe).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('says so when permission is refused, and registers nothing', async () => {
    const { host, calls } = browser({ asked: 'denied' });
    await expect(enablePush(host)).rejects.toBeInstanceOf(PushError);
    expect(calls).toHaveLength(0);
  });

  it('does not ask again when permission was already denied', async () => {
    const { host } = browser({ permission: 'denied' });
    await expect(enablePush(host)).rejects.toThrow(/blocked/);
  });

  it('throws the server’s refusal', async () => {
    const { host } = browser({
      responses: { 'POST /api/push/subscriptions': 400 },
    });
    await expect(enablePush(host)).rejects.toThrow();
  });
});

describe('disablePush', () => {
  it('forgets the subscription on the server and in the browser', async () => {
    const { host, subscription, calls } = browser({ existing: true });
    await disablePush(host);
    const id = await subscriptionId(ENDPOINT);
    expect(calls).toEqual([
      expect.objectContaining({
        method: 'DELETE',
        url: `/api/push/subscriptions/${id}`,
      }),
    ]);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('still unsubscribes when the server had already forgotten it', async () => {
    const id = await subscriptionId(ENDPOINT);
    const { host, subscription } = browser({
      existing: true,
      responses: { [`DELETE /api/push/subscriptions/${id}`]: 404 },
    });
    await disablePush(host);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('does nothing without a subscription', async () => {
    const { host, calls } = browser({});
    await disablePush(host);
    expect(calls).toHaveLength(0);
  });
});

describe('sendTest', () => {
  it('posts to the subscription’s tests', async () => {
    const { host, calls } = browser({ existing: true });
    await sendTest(host);
    const id = await subscriptionId(ENDPOINT);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `/api/push/subscriptions/${id}/tests`,
    });
  });

  it('asks to turn notifications on first when there is no subscription', async () => {
    await expect(sendTest(browser({}).host)).rejects.toBeInstanceOf(PushError);
  });

  it('throws the server’s refusal', async () => {
    const id = await subscriptionId(ENDPOINT);
    const { host } = browser({
      existing: true,
      responses: { [`POST /api/push/subscriptions/${id}/tests`]: 502 },
    });
    await expect(sendTest(host)).rejects.toThrow();
  });
});

describe('the live browser', () => {
  it('reads what this browser can do', () => {
    Object.assign(globalThis, {
      navigator: { userAgent: 'x', maxTouchPoints: 0 },
      window: { matchMedia: () => ({ matches: false }) },
    });
    expect(browserCapabilities()).toMatchObject({
      hasServiceWorker: false,
      hasPushManager: false,
      hasNotification: false,
      standalone: false,
    });
    expect(typeof browserHost().permission).toBe('function');
  });
});
