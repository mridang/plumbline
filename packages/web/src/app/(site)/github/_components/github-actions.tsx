'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { ensureOk, problemText } from '@/components/api/problem-message';
import { Button } from '@/components/ui/button';

/** Post to a GitHub endpoint of this site. */
export async function postTo(
  path: string,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  await ensureOk(await transport(path, { method: 'POST' }));
}

/** A button that posts to `path`, then reloads the page to show what changed. */
function ActionButton({
  path,
  label,
  busyLabel,
  failure,
  confirm,
}: Readonly<{
  path: string;
  label: string;
  busyLabel: string;
  failure: string;
  confirm?: string;
}>): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (): Promise<void> => {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await postTo(path);
      router.refresh();
    } catch (error) {
      setProblem(problemText(error, failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Button variant="outline" disabled={busy} onClick={() => void run()}>
        {busy ? busyLabel : label}
      </Button>
      {problem ? (
        <p role="alert" className="mt-2 text-failed">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** "Refresh": reads the installations again, so new repositories and changed deployments show up. */
export function SyncButton(): ReactElement {
  return (
    <ActionButton
      path="/api/github/sync"
      label="Refresh from GitHub"
      busyLabel="Reading repositories…"
      failure="The repositories could not be read."
    />
  );
}

/** "Disconnect": forgets the GitHub account, its installations and repositories. */
export function DisconnectButton(): ReactElement {
  return (
    <ActionButton
      path="/api/github/disconnect"
      label="Disconnect GitHub"
      busyLabel="Disconnecting…"
      failure="GitHub could not be disconnected."
      confirm="Disconnect GitHub? Your domains and reports stay."
    />
  );
}
