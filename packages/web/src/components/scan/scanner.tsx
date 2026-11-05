'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';

import { Button } from '@/components/ui/button';
import { problemText } from '@/components/api/problem-message';
import { runScan } from '@/domain/scan/session';

import { ScanResults, type Scan } from './scan-results';

/** Where the scan is. */
export type ScanState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting'; readonly domain: string }
  | { readonly kind: 'scanning'; readonly scan: Scan }
  | { readonly kind: 'error'; readonly message: string };

/** What a page asks of a scan besides the domain. */
export interface ScanRequest {
  /** Run only these checks (every check when left out). */
  readonly only?: readonly string[];
  /** Told once every check has run, with the finished scan. */
  readonly onFinished?: (scan: Scan) => void;
}

/**
 * Run scans from a page: the state to draw, and a function that starts one.
 * Outcomes are shown as they arrive; once every check has run the finished
 * scan is handed to `onFinished` (to save it, say).
 */
export function useScan({ only, onFinished }: ScanRequest = {}): {
  readonly state: ScanState;
  readonly run: (domain: string) => Promise<void>;
} {
  const [state, setState] = useState<ScanState>({ kind: 'idle' });

  const run = async (value: string): Promise<void> => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    setState({ kind: 'starting', domain: trimmed });
    const startedAt = Date.now();
    // The scan as it builds up, kept here as well so the finished one can be
    // handed on without waiting for a render.
    let current: Scan | undefined;
    const show = (scan: Scan): void => {
      current = scan;
      setState({ kind: 'scanning', scan });
    };
    try {
      await runScan(
        trimmed,
        {
          onStart: ({ finalUrl, status, hints }) =>
            show({
              finalUrl,
              status,
              total: hints.length,
              hints: [],
              startedAt,
            }),
          onOutcome: (outcome) => {
            if (current) {
              show({ ...current, hints: [...current.hints, outcome] });
            }
          },
        },
        only === undefined ? {} : { only },
      );
      if (current) {
        const finished: Scan = { ...current, finishedAt: Date.now() };
        show(finished);
        onFinished?.(finished);
      }
    } catch (error) {
      setState({
        kind: 'error',
        message: problemText(
          error,
          'Could not reach the scanner. Check your connection.',
        ),
      });
    }
  };
  return { state, run };
}

/** Whether a scan is starting or still has checks to run. */
export function isRunning(state: ScanState): boolean {
  return (
    state.kind === 'starting' ||
    (state.kind === 'scanning' && state.scan.finishedAt === undefined)
  );
}

/** What is said while a scan starts, or why it could not. */
export function ScanStatus({
  state,
  className = 'mt-8',
}: Readonly<{
  state: ScanState;
  /** The space around it, where it sits on the page. */
  className?: string;
}>): ReactElement {
  return (
    <div aria-live="polite" className={className}>
      {state.kind === 'starting' ? (
        <p className="text-muted">
          Fetching{' '}
          <span className="font-semibold text-ink">{state.domain}</span>…
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p
          role="alert"
          className="rounded-card border border-failed/30 bg-failed/5 px-4 py-3 text-failed"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/** The box to type a domain into, and what the scan found. */
export function Scanner({
  className = 'mt-10',
}: Readonly<{
  /** The space above it, where it sits on the page. */
  className?: string;
}> = {}): ReactElement {
  const { state, run } = useScan();
  const input = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const scan = async (value: string): Promise<void> => {
    if (value.trim() !== '') {
      // The address carries the domain, so a result can be shared or reloaded.
      const url = new URL(window.location.href);
      url.searchParams.set('domain', value.trim());
      window.history.replaceState(null, '', url);
    }
    await run(value);
  };

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const given = new URLSearchParams(window.location.search).get('domain');
    // A shared link starts its scan by submitting the form, as a click would.
    if (given && input.current) {
      input.current.value = given;
      input.current.form?.requestSubmit();
    }
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void scan(input.current?.value ?? '');
  };

  const running = isRunning(state);
  return (
    <div className={className}>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
      >
        <label htmlFor="domain" className="sr-only">
          Domain or URL
        </label>
        <input
          id="domain"
          name="domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="example.com"
          ref={input}
          className="focus-ring-flush h-12 w-full rounded-control border border-field bg-surface px-4 text-base sm:flex-1"
          required
        />
        <Button type="submit" size="lg" variant="accent" disabled={running}>
          {running ? 'Scanning…' : 'Scan'}
        </Button>
      </form>
      <ScanStatus state={state} />
      {state.kind === 'scanning' ? <ScanResults scan={state.scan} /> : null}
    </div>
  );
}
