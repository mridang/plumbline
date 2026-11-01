'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { ensureOk, problemText } from '@/components/api/problem-message';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/** Remove a domain (`DELETE /api/domains/{id}`). */
export async function removeDomain(
  domainId: string,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  const response = await transport(`/api/domains/${domainId}`, {
    method: 'DELETE',
  });
  await ensureOk(response);
}

/** "Remove domain": asks first, removes it with its reports, then goes back to the list. */
export function RemoveDomainButton({
  domainId,
  host,
}: Readonly<{ domainId: string; host: string }>): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const remove = async (): Promise<void> => {
    setBusy(true);
    try {
      await removeDomain(domainId);
      router.push('/domains');
    } catch (error) {
      setProblem(problemText(error, 'The domain could not be removed.'));
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>
        {busy ? 'Removing…' : 'Remove domain'}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Remove ${host}?`}
        description="The domain and all of its reports will be removed."
        confirmLabel="Remove domain"
        onConfirm={() => void remove()}
      />
      {problem ? (
        <p role="alert" className="mt-2 text-failed">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
