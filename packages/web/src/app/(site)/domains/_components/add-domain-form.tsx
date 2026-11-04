'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';

import { ensureOk, problemText } from '@/components/api/problem-message';
import { Button } from '@/components/ui/button';

/** Add a domain (`POST /api/domains`), then open its page. */
export async function addDomain(
  host: string,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<string> {
  const response = await transport('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host }),
  });
  await ensureOk(response);
  const body = (await response.json()) as { id: string };
  return body.id;
}

/**
 * The box to add a domain with. A domain the person already has opens its
 * page instead (the server answers with the one they have).
 */
export function AddDomainForm(): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const host = String(new FormData(event.currentTarget).get('host') ?? '');
    setBusy(true);
    setProblem(null);
    try {
      router.push(`/domains/${await addDomain(host)}`);
    } catch (error) {
      setProblem(problemText(error, 'The domain could not be added.'));
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="host" className="sr-only">
        Domain
      </label>
      <input
        id="host"
        name="host"
        type="text"
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="example.com"
        className="focus-ring-flush h-12 w-full rounded-control border border-field bg-surface px-4 text-base sm:flex-1"
        required
      />
      <Button type="submit" size="lg" variant="accent" disabled={busy}>
        {busy ? 'Adding…' : 'Add domain'}
      </Button>
      {problem ? (
        <p role="alert" className="text-failed sm:basis-full">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
