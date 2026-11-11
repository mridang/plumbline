/**
 * @packageDocumentation
 *
 * When a page keeps its live connection open. Every open stream holds a
 * connection and a writer in the person's `UserHub` for as long as it lives,
 * so a tab nobody is looking at must not keep one. The page closes the stream
 * once the tab has been hidden for {@link HIDDEN_GRACE_MS} (a short look at
 * another tab keeps it), closes it at once when the page is put away
 * (`pagehide`), and opens it again, with a catch-up read, when the tab is shown
 * or the page is brought back. The browser and the clock are passed in, so the
 * rules can be tested without either.
 */

/** How long a tab may stay hidden before its stream is closed, in milliseconds. */
export const HIDDEN_GRACE_MS = 30_000;

/** What the page does with its stream. */
export interface Stream {
  /** Open the stream; the page reads the overview again when it opens. */
  open(): void;
  /** Close the stream and let go of its connection. */
  close(): void;
}

/** The parts of the browser and the clock the rules use. */
export interface Environment {
  /** Whether the tab is showing. */
  visible(): boolean;
  /** Call `handler` whenever the tab is shown or hidden; returns how to stop. */
  onVisibilityChange(handler: () => void): () => void;
  /** Call `handler` when the page is put away (a navigation, a closed tab). */
  onPageHide(handler: () => void): () => void;
  /** Call `handler` when the page is shown again, `persisted` if it came back from the back-forward cache. */
  onPageShow(handler: (persisted: boolean) => void): () => void;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}

/**
 * Keep `stream` open while the tab is showing (and for a short while after it
 * is hidden), closed otherwise. Opens it now when the tab is showing. Returns
 * how to stop, which also closes the stream.
 */
export function keepStreamWhileVisible(
  stream: Stream,
  environment: Environment,
  graceMs: number = HIDDEN_GRACE_MS,
): () => void {
  let isOpen = false;
  let timer: unknown = null;
  const open = (): void => {
    if (!isOpen) {
      isOpen = true;
      stream.open();
    }
  };
  const close = (): void => {
    if (isOpen) {
      isOpen = false;
      stream.close();
    }
  };
  const cancelGrace = (): void => {
    if (timer !== null) {
      environment.clearTimeout(timer);
      timer = null;
    }
  };
  const changed = (): void => {
    cancelGrace();
    if (environment.visible()) {
      open();
    } else if (isOpen) {
      timer = environment.setTimeout(() => {
        timer = null;
        close();
      }, graceMs);
    } else {
      // The stream is already closed, so there is nothing to wait for.
    }
  };
  const stops = [
    environment.onVisibilityChange(changed),
    environment.onPageHide(() => {
      cancelGrace();
      close();
    }),
    environment.onPageShow((persisted) => {
      if (persisted) {
        changed();
      }
    }),
  ];
  if (environment.visible()) {
    open();
  }
  return () => {
    cancelGrace();
    stops.forEach((stop) => stop());
    close();
  };
}

/** The real browser and clock. */
export function browserEnvironment(): Environment {
  const listen = <T extends Event>(
    target: EventTarget,
    name: string,
    handler: (event: T) => void,
  ): (() => void) => {
    const wrapped = (event: Event): void => handler(event as T);
    target.addEventListener(name, wrapped);
    return () => target.removeEventListener(name, wrapped);
  };
  return {
    visible: () => document.visibilityState === 'visible',
    onVisibilityChange: (handler) =>
      listen(document, 'visibilitychange', handler),
    onPageHide: (handler) => listen(globalThis, 'pagehide', handler),
    onPageShow: (handler) =>
      listen<PageTransitionEvent>(globalThis, 'pageshow', (event) =>
        handler(event.persisted),
      ),
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout: (timer) => clearTimeout(timer as number),
  };
}
