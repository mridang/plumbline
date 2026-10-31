/**
 * @packageDocumentation
 *
 * A scan in the browser: the real hint classes from the hints package, driven
 * by a stand-in for webhint's engine. Webhint itself needs Node's file system
 * and a Chromium to drive, but the hints only use a narrow slice of its
 * context: `on` for four events, `report`, `fetchContent`, the page's headers
 * and content, and an `engineKey`. This file provides exactly that slice.
 *
 * The page is fetched once ({@link loadPage}), parsed with webhint's own DOM
 * (`@hint/utils-dom`, pure JavaScript), and then each hint is run on its own
 * ({@link runHint}), given these events in the order webhint emits them:
 * `scan::start`, `fetch::end::html`, `traverse::end`, `scan::end`. One hint at
 * a time, so what the browser refused it (see the hints package's
 * `browser/refusals.ts`) is known to be its own.
 *
 * A hint is "skipped", not "passed", when it could not do its work here: it
 * asked for the page's script (`evaluate`), for a raw connection, a program or
 * a certificate the browser cannot give, it threw, it ran out of time, or it
 * listened only for events this engine never emits (scripts and other
 * sub-resources that only a browser loads). The Docker image runs the same
 * hints with Chromium.
 */

import type { HintContext, NetworkData, ReportOptions } from 'hint';
import { createHTMLDocument } from '@hint/utils-dom';
import { Severity } from '@hint/utils-types';

import {
  takeRefusals,
  type Refusal,
} from '@mridang/webhint-hint-extra/dist/browser/refusals.js';

import type { CatalogueEntry, HintInfo } from './catalogue';

/** How serious a finding is, in the words the page uses. */
type FindingLevel = 'error' | 'warning' | 'hint' | 'information';

/** One thing a hint reported. */
export interface Finding {
  readonly resource: string;
  readonly message: string;
  readonly level: FindingLevel;
  /** The evidence: the header, the markup or the record at fault. */
  readonly snippet?: string;
  /** What the snippet is written in (`http`, `html`, …). */
  readonly language?: string;
  /** Where in the resource, when the hint knows. */
  readonly line?: number;
  readonly column?: number;
  /** Further reading the hint gave for this finding, besides its own reference. */
  readonly links?: readonly FindingLink[];
}

/** A page a finding points to for more on the problem or its fix. */
export interface FindingLink {
  readonly url: string;
  readonly text: string;
}

/** What became of one hint. */
export type HintStatus = 'failed' | 'warned' | 'passed' | 'skipped';

/** One hint's outcome. */
export interface HintOutcome extends HintInfo {
  readonly status: HintStatus;
  /** Why a skipped hint did not run. */
  readonly reason?: string;
  readonly findings: readonly Finding[];
}

/** Fetches a resource as webhint's `fetchContent` does. */
export type FetchContent = (
  target: URL | string,
  headers?: object,
) => Promise<NetworkData>;

/** The scanned page, fetched and parsed once for every hint. */
export interface Page {
  /** The address that was asked for. */
  readonly url: string;
  /** The final response, after any redirects. */
  readonly data: NetworkData;
  /** The final response's markup, parsed. */
  readonly document: ReturnType<typeof createHTMLDocument>;
}

/** Thrown into a hint that asks to run script in a browser. */
class NeedsBrowserError extends Error {
  public constructor() {
    super('Needs a browser to run script in the page.');
    this.name = 'NeedsBrowserError';
  }
}

/** Thrown into a hint that takes too long. */
class TimedOutError extends Error {
  public constructor(ms: number) {
    super(`Took longer than ${Math.round(ms / 1000)} seconds.`);
    this.name = 'TimedOutError';
  }
}

/**
 * Hints whose whole check is script run in the page. They catch the refusal of
 * `evaluate` and report "could not evaluate", which says nothing about the
 * site, so they are skipped outright. (Hints that use the browser for only part
 * of their check, such as the cookie one, still run the rest.)
 */
const BROWSER_ONLY: ReadonlySet<string> = new Set([
  'agent-webmcp',
  'privacy-local-storage',
]);

/** The events this engine emits, in order. */
const EVENTS = [
  'scan::start',
  'fetch::end::html',
  'traverse::end',
  'scan::end',
] as const;

/** One of {@link EVENTS}. */
type EventName = (typeof EVENTS)[number];

/** A hint's handler for one event. */
type Handler = (event: unknown) => unknown;

/** Webhint's severities, in the page's words; `off` findings are dropped. */
function levelOf(severity: Severity | undefined): FindingLevel | null {
  switch (severity) {
    case Severity.off:
      return null;
    case Severity.information:
      return 'information';
    case Severity.hint:
      return 'hint';
    case Severity.warning:
      return 'warning';
    default:
      return 'error';
  }
}

/** The longest snippet kept; a whole `<head>` helps nobody. */
const MAX_SNIPPET = 2000;

/** The most further-reading links kept for one finding. */
const MAX_LINKS = 5;

/**
 * The further-reading links of a report, as plain http(s) links. The hint's own
 * reference is left out: every finding of the hint carries it (see the hints
 * package's `defineHint`) and the page shows it once for the hint.
 */
function linksOf(
  documentation: ReportOptions['documentation'],
  reference: string | undefined,
): FindingLink[] {
  return (documentation ?? [])
    .filter((doc) => /^https?:\/\//.test(doc.link) && doc.link !== reference)
    .slice(0, MAX_LINKS)
    .map((doc) => ({ url: doc.link, text: doc.text || doc.link }));
}

/**
 * A report call turned into a finding, or null for an `off` one. `reference`
 * is the hint's own reference, which is not repeated in the finding's links.
 */
export function findingOf(
  resource: string,
  message: string,
  options: Partial<ReportOptions>,
  reference?: string,
): Finding | null {
  const level = levelOf(options.severity);
  if (level === null) {
    return null;
  }
  const element = options.element ?? null;
  let snippet = options.codeSnippet;
  let location = options.location ?? null;
  if (element) {
    try {
      snippet ??= element.outerHTML;
      location ??= element.getLocation();
    } catch {
      // An element from a document the engine did not parse has no source.
    }
  }
  const language = options.codeLanguage ?? (element ? 'html' : undefined);
  const placed =
    location && location.line >= 0
      ? { line: location.line + 1, column: location.column + 1 }
      : {};
  const links = linksOf(options.documentation, reference);
  return {
    resource,
    message,
    level,
    ...(snippet ? { snippet: snippet.slice(0, MAX_SNIPPET) } : {}),
    ...(language ? { language } : {}),
    ...placed,
    ...(links.length > 0 ? { links } : {}),
  };
}

/** The status of a hint that ran, from what it reported. */
export function statusOf(findings: readonly Finding[]): HintStatus {
  if (findings.some((f) => f.level === 'error')) {
    return 'failed';
  }
  if (findings.some((f) => f.level === 'warning')) {
    return 'warned';
  }
  return 'passed';
}

/** `promise`, or a {@link TimedOutError} once `ms` have passed. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimedOutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The sentence shown for a hint the browser refused something. */
function refusalReason(refused: ReadonlySet<Refusal>): string {
  return refused.has('crypto') && refused.size === 1
    ? 'Needs the full scanner: it reads certificates or keys a browser cannot parse.'
    : 'Needs the full scanner: it opens raw connections or runs programs, which a browser cannot.';
}

/** The sentence shown for a hint that threw. */
function reasonOf(error: unknown): string {
  if (error instanceof NeedsBrowserError || error instanceof TimedOutError) {
    return error.message;
  }
  return 'Needs the full scanner: it uses something a browser cannot do.';
}

/** One hint while it runs: its handlers, what it reported, and whether it broke. */
interface Running {
  readonly entry: CatalogueEntry;
  readonly handlers: Map<string, Handler[]>;
  readonly findings: Finding[];
  failure?: unknown;
}

/** The stand-in context one hint is given. */
function contextFor(
  running: Running,
  page: Page,
  fetchContent: FetchContent,
): HintContext {
  const context = {
    engineKey: page,
    hintOptions: undefined,
    pageContent: page.data.response.body.content,
    pageHeaders: page.data.response.headers,
    targetedBrowsers: [],
    on(name: string, handler: Handler): void {
      const list = running.handlers.get(name) ?? [];
      list.push(handler);
      running.handlers.set(name, list);
    },
    report(
      resource: string,
      message: string,
      options: Partial<ReportOptions> = {},
    ): void {
      const finding = findingOf(
        resource,
        message,
        options,
        running.entry.info.reference,
      );
      if (finding) {
        running.findings.push(finding);
      }
    },
    fetchContent,
    evaluate(): Promise<never> {
      return Promise.reject(new NeedsBrowserError());
    },
    isInHead: () => false,
  };
  // Only the members above are ever read by the hints in this package.
  return context as unknown as HintContext;
}

/** A skipped outcome. */
function skipped(
  info: HintInfo,
  reason: string,
  findings: readonly Finding[] = [],
): HintOutcome {
  return { ...info, status: 'skipped', reason, findings };
}

/** What one hint came to, given what the browser refused it. */
function outcomeOf(
  running: Running,
  refused: ReadonlySet<Refusal>,
): HintOutcome {
  const { info } = running.entry;
  const listened = [...running.handlers.keys()];
  if (BROWSER_ONLY.has(info.id)) {
    return skipped(info, 'Needs a browser: it runs script in the page.');
  }
  if (refused.size > 0) {
    return skipped(info, refusalReason(refused));
  }
  if (running.failure !== undefined) {
    return skipped(info, reasonOf(running.failure), running.findings);
  }
  if (
    running.findings.length === 0 &&
    listened.length > 0 &&
    !listened.some((name) => (EVENTS as readonly string[]).includes(name))
  ) {
    return skipped(
      info,
      'Needs a browser: it checks resources only a browser loads.',
    );
  }
  return {
    ...info,
    status: statusOf(running.findings),
    findings: running.findings,
  };
}

/**
 * Fetch and parse the page at `target` once, for every hint. Throws when the
 * page cannot be fetched, as webhint's `fetchContent` does.
 */
export async function loadPage(
  target: URL,
  fetchContent: FetchContent,
): Promise<Page> {
  const data = await fetchContent(target);
  return {
    url: target.href,
    data,
    document: createHTMLDocument(data.response.body.content, data.response.url),
  };
}

/** How long one hint may spend on one event, in milliseconds. */
const HINT_TIMEOUT_MS = 20_000;

/**
 * Run one hint against a loaded page and say what it found. Run hints one at a
 * time in a realm: what the browser refused is noted for the whole realm, and
 * is read as this hint's when it is done.
 */
export async function runHint(
  entry: CatalogueEntry,
  page: Page,
  fetchContent: FetchContent,
  timeoutMs: number = HINT_TIMEOUT_MS,
): Promise<HintOutcome> {
  takeRefusals();
  const running: Running = { entry, handlers: new Map(), findings: [] };
  try {
    new entry.ctor(contextFor(running, page, fetchContent));
  } catch (error) {
    running.failure = error;
  }
  const finalUrl = page.data.response.url;
  const events: readonly [EventName, unknown][] = [
    ['scan::start', { resource: page.url }],
    [
      'fetch::end::html',
      {
        resource: finalUrl,
        request: page.data.request,
        response: page.data.response,
        element: null,
      },
    ],
    ['traverse::end', { resource: finalUrl, document: page.document }],
    ['scan::end', { resource: page.url }],
  ];
  for (const [name, event] of events) {
    if (running.failure !== undefined) {
      break;
    }
    try {
      await withTimeout(
        Promise.all(
          (running.handlers.get(name) ?? []).map((handler) =>
            Promise.resolve().then(() => handler(event)),
          ),
        ),
        timeoutMs,
      );
    } catch (error) {
      running.failure = error;
    }
  }
  return outcomeOf(running, takeRefusals());
}
