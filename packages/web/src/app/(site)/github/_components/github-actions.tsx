'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { ensureOk, problemText } from '@/components/api/problem-message';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/site/confirm-dialog';

/** Call a GitHub endpoint of this site. */
export async function callOn(
  path: string,
  method: 'POST' | 'DELETE',
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  await ensureOk(await transport(path, { method }));
}

/** A button that calls `path` with `method`, then reloads the page to show what changed. */
function ActionButton({
  path,
  method,
  label,
  busyLabel,
  failure,
  confirm,
}: Readonly<{
  path: string;
  method: 'POST' | 'DELETE';
  label: string;
  busyLabel: string;
  failure: string;
  /** What to tell the person before going ahead; leave out to act at once. */
  confirm?: string;
}>): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const run = async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      await callOn(path, method);
      router.refresh();
    } catch (error) {
      setProblem(problemText(error, failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => (confirm ? setAsking(true) : void run())}
      >
        {busy ? busyLabel : label}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={`${label}?`}
          description={confirm}
          confirmLabel={label}
          onConfirm={() => void run()}
        />
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 text-failed">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** "Disconnect": forgets the GitHub account, its installations and repositories. */
export function DisconnectButton(): ReactElement {
  return (
    <ActionButton
      path="/api/users/self/github"
      method="DELETE"
      label="Disconnect GitHub"
      busyLabel="Disconnecting…"
      failure="GitHub could not be disconnected."
      confirm="Your sites and reports stay."
    />
  );
}
