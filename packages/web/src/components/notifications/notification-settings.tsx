'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { problemText } from '@/components/api/problem-message';
import {
  browserCapabilities,
  browserHost,
  currentSubscription,
  disablePush,
  enablePush,
  PushError,
  pushSupport,
  sendTest,
  type PushSupport,
} from '@/components/notifications/push-client';
import { InstallIosHint } from '@/components/site/install-ios-hint';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/** What the page knows about this browser. */
type Status =
  | { readonly kind: 'checking' }
  | { readonly kind: 'unavailable'; readonly support: PushSupport }
  | {
      readonly kind: 'ready';
      readonly subscribed: boolean;
      readonly blocked: boolean;
    };

/** What a person is told about, in the order the page lists it. */
export const NOTIFICATION_TOPICS: readonly string[] = [
  'The number of problems on one of your sites changes after a check.',
  'A site starts to fail, or is fixed again.',
];

/** What this browser can do and has done about notifications. */
async function detect(): Promise<Status> {
  const support = pushSupport(browserCapabilities());
  if (support !== 'supported') {
    return { kind: 'unavailable', support };
  }
  const subscription = await currentSubscription(browserHost()).catch(
    () => null,
  );
  return {
    kind: 'ready',
    subscribed: subscription !== null && Notification.permission === 'granted',
    blocked: Notification.permission === 'denied',
  };
}

/** The words for what went wrong. */
function wordsFor(error: unknown): string {
  return error instanceof PushError
    ? error.message
    : problemText(error, 'Could not reach Plumbline. Check your connection.');
}

/**
 * Turns notifications about your sites on and off for this browser, and sends a test
 * one. Whether the browser can do it at all is only known in the browser, so the
 * server and the first render say "checking".
 */
export function NotificationSettings(): ReactElement {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    readonly text: string;
    readonly error: boolean;
  } | null>(null);

  const refresh = useCallback(
    async (): Promise<void> => setStatus(await detect()),
    [],
  );

  useEffect(() => {
    let current = true;
    void detect().then((next) => {
      if (current) {
        setStatus(next);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  const run = async (
    work: () => Promise<string | undefined>,
  ): Promise<void> => {
    setBusy(true);
    try {
      const text = await work();
      setMessage(text ? { text, error: false } : null);
    } catch (error) {
      setMessage({ text: wordsFor(error), error: true });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section
        aria-labelledby="notifications-state"
        className="rounded-card border border-field/60 bg-surface p-6"
      >
        <h2 id="notifications-state" className="text-lg font-semibold text-ink">
          Notifications on this device
        </h2>
        <Controls
          status={status}
          busy={busy}
          onEnable={() =>
            run(async () => {
              await enablePush(browserHost());
              return 'Notifications are on.';
            })
          }
          onDisable={() =>
            run(async () => {
              await disablePush(browserHost());
              return 'Notifications are off.';
            })
          }
          onTest={() =>
            run(async () => {
              await sendTest(browserHost());
              return 'Test notification sent.';
            })
          }
        />
        {message ? (
          <Callout tone={message.error ? 'error' : 'plain'} className="mt-4">
            {message.text}
          </Callout>
        ) : null}
      </section>
      <section aria-labelledby="notifications-topics">
        <h2
          id="notifications-topics"
          className="text-lg font-semibold text-ink"
        >
          What you will be told
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {NOTIFICATION_TOPICS.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Each device you turn this on for is told separately, and you can turn
          it off again here.
        </p>
      </section>
    </div>
  );
}

/** The state of this browser and the buttons that change it. */
function Controls({
  status,
  busy,
  onEnable,
  onDisable,
  onTest,
}: Readonly<{
  status: Status;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onTest: () => void;
}>): ReactElement {
  if (status.kind === 'checking') {
    return <p className="mt-2 text-sm text-muted">Checking this browser…</p>;
  }
  if (status.kind === 'unavailable') {
    return status.support === 'needs-install' ? (
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-muted">
          On iPhone and iPad, notifications only work once Plumbline is added to
          the Home Screen. Add it, open it from there, and come back to this
          page.
        </p>
        <InstallIosHint />
      </div>
    ) : (
      <div className="mt-3">
        <Callout>
          This browser cannot show notifications. Try a recent Chrome, Edge,
          Firefox or Safari.
        </Callout>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-4">
      <p className="text-sm text-muted">
        {status.blocked
          ? 'Notifications are blocked for this site. Allow them in the browser settings, then turn them on here.'
          : status.subscribed
            ? 'Notifications are on.'
            : 'Notifications are off.'}
      </p>
      <div className="flex flex-wrap gap-3">
        {status.subscribed ? (
          <Button variant="outline" disabled={busy} onClick={onDisable}>
            Turn off
          </Button>
        ) : (
          <Button disabled={busy || status.blocked} onClick={onEnable}>
            Turn on notifications
          </Button>
        )}
        {status.subscribed ? (
          <Button variant="ghost" disabled={busy} onClick={onTest}>
            Send a test notification
          </Button>
        ) : null}
      </div>
    </div>
  );
}
