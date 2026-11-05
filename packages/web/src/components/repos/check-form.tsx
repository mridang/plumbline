'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';

import { ensureOk, problemText } from '@/components/api/problem-message';
import { Button } from '@/components/ui/button';

/** One check as the form lists it. */
export interface CheckChoice {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/** One section of the form: a report section and its checks. */
export interface CheckSection {
  readonly id: string;
  readonly title: string;
  readonly checks: readonly CheckChoice[];
}

/**
 * The `checks` to send for the ticked boxes: null when every check is ticked
 * (so checks added later run too), otherwise the ticked ids.
 */
export function checksToSend(
  ticked: ReadonlySet<string>,
  total: number,
): readonly string[] | null {
  return ticked.size === total ? null : [...ticked].toSorted();
}

/** Choose a domain's checks (`PATCH /api/domains/{id}`, JSON Merge Patch). */
export async function saveChecks(
  domainId: string,
  checks: readonly string[] | null,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  const response = await transport(`/api/domains/${domainId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    body: JSON.stringify({ checks }),
  });
  await ensureOk(response);
}

/**
 * The check configuration form: every check, grouped by report section, with a
 * box each and a switch for a whole section. Saving sends the ticked ones and
 * reloads the page, so "Run checks" runs the new set.
 */
export function CheckForm({
  domainId,
  sections,
  enabled,
}: Readonly<{
  domainId: string;
  sections: readonly CheckSection[];
  enabled: readonly string[];
}>): ReactElement {
  const router = useRouter();
  const total = sections.reduce((sum, s) => sum + s.checks.length, 0);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(enabled),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { readonly ok: boolean; readonly text: string } | undefined
  >();

  const toggle = (ids: readonly string[], on: boolean): void =>
    setTicked((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    try {
      await saveChecks(domainId, checksToSend(ticked, total));
      setMessage({ ok: true, text: 'Saved.' });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text: problemText(error, 'The checks could not be saved.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          {ticked.size} of {total} checks on
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toggle(
              sections.flatMap((s) => s.checks.map((c) => c.id)),
              true,
            )
          }
        >
          All on
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toggle(
              sections.flatMap((s) => s.checks.map((c) => c.id)),
              false,
            )
          }
        >
          All off
        </Button>
      </div>
      <div className="mt-6 space-y-4">
        {sections.map((section) => {
          const ids = section.checks.map((c) => c.id);
          const on = ids.filter((id) => ticked.has(id)).length;
          return (
            <details
              key={section.id}
              className="rounded-card border border-line bg-surface"
            >
              <summary className="focus-ring-flush flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{section.title}</span>
                <span className="text-sm text-subtle tabular-nums">
                  {on} of {ids.length}
                </span>
              </summary>
              <div className="border-t border-line px-4 py-3">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="focus-ring"
                    checked={on === ids.length}
                    onChange={(event) => toggle(ids, event.target.checked)}
                  />
                  Every check in this section
                </label>
                <ul className="mt-3 space-y-2">
                  {section.checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-3">
                      <input
                        id={`check-${check.id}`}
                        type="checkbox"
                        className="focus-ring mt-1"
                        name="checks"
                        value={check.id}
                        checked={ticked.has(check.id)}
                        onChange={(event) =>
                          toggle([check.id], event.target.checked)
                        }
                      />
                      <label htmlFor={`check-${check.id}`}>
                        <span className="font-medium">{check.name}</span>
                        <span className="block text-sm text-muted">
                          {check.description}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save checks'}
        </Button>
        {message ? (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={message.ok ? 'text-sm text-muted' : 'text-failed'}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
