import { describe, expect, it } from '@jest/globals';
import type { HintContext } from 'hint';
import { Severity } from '@hint/utils-types';
import { refuse } from '@mridang/webhint-hint-plumbline/dist/browser/refusals.js';

import { entryOf, type CatalogueEntry } from '@/domain/scan/catalogue';
import {
  findingOf,
  loadPage,
  runHint,
  statusOf,
  type FetchContent,
  type HintOutcome,
  type Page,
} from '@/domain/scan/engine';
import { fetchResource } from '@/domain/scan/network';
import type { Relay, Relayed } from '@/domain/scan/relay';

/** The page every scan here fetches. */
const PAGE = `<!doctype html>
<html>
<head><title>Hi</title></head>
<body><img src="/a.png"></body>
</html>`;

/** What the target answers, as the Worker relays it. */
function answer(
  status: number,
  body: string,
  headers: [string, string][] = [],
  url = '',
): Relayed {
  return { status, url, headers, body: new TextEncoder().encode(body) };
}

/** A relay that serves the page, one redirect and a robots.txt, counting calls. */
function site(calls: string[] = []): Relay {
  return async ({ url }) => {
    calls.push(url);
    switch (url) {
      case 'https://example.com/':
        return answer(301, '', [['location', 'https://www.example.com/']], url);
      case 'https://www.example.com/':
        return answer(
          200,
          PAGE,
          [
            ['content-type', 'text/html; charset=utf-8'],
            ['x-frame-options', 'DENY'],
          ],
          url,
        );
      case 'https://example.com/robots.txt':
        return answer(200, 'User-agent: *', [], url);
      default:
        return answer(404, '', [], url);
    }
  };
}

/** A `fetchContent` over `relay`, as the scan worker makes one. */
function contentFrom(relay: Relay): FetchContent {
  return (url, headers = {}) =>
    fetchResource(url, headers as Record<string, string>, relay);
}

/** A hint whose setup is `setup`. */
function fake(
  id: string,
  setup: (context: HintContext) => void,
): CatalogueEntry {
  class Fake {
    public static readonly meta = { docs: { name: `Hint ${id}` } };

    public constructor(context: HintContext) {
      setup(context);
    }
  }
  return entryOf(id, Fake);
}

/** example.com, loaded through `relay`. */
async function page(relay: Relay = site()): Promise<Page> {
  return loadPage(new URL('https://example.com/'), contentFrom(relay));
}

/** Run one hint against example.com. */
async function run(
  entry: CatalogueEntry,
  relay: Relay = site(),
  timeoutMs = 2000,
): Promise<HintOutcome> {
  return runHint(entry, await page(relay), contentFrom(relay), timeoutMs);
}

describe('findingOf', () => {
  it('keeps the snippet, language and position a hint gives, one-based', () => {
    expect(
      findingOf('https://a.test/', 'Bad header', {
        severity: Severity.warning,
        codeSnippet: 'X-Thing: 1',
        codeLanguage: 'http',
        location: { line: 0, column: 4 },
      }),
    ).toEqual({
      resource: 'https://a.test/',
      message: 'Bad header',
      level: 'warning',
      snippet: 'X-Thing: 1',
      language: 'http',
      line: 1,
      column: 5,
    });
  });

  it.each([
    [Severity.error, 'error'],
    [Severity.warning, 'warning'],
    [Severity.hint, 'hint'],
    [Severity.information, 'information'],
    [Severity.default, 'error'],
    [undefined, 'error'],
  ])('calls severity %s %s', (severity, level) => {
    expect(findingOf('r', 'm', { severity })?.level).toBe(level);
  });

  it('drops a finding that is switched off', () => {
    expect(findingOf('r', 'm', { severity: Severity.off })).toBeNull();
  });

  it('leaves out an unknown position', () => {
    expect(
      findingOf('r', 'm', {
        severity: Severity.error,
        location: { line: -1, column: -1 },
      }),
    ).toEqual({ resource: 'r', message: 'm', level: 'error' });
  });

  it('keeps the further reading a hint gives, but not its own reference', () => {
    expect(
      findingOf(
        'r',
        'm',
        {
          severity: Severity.error,
          documentation: [
            { link: 'https://rule.test/', text: 'The rule' },
            { link: 'https://fix.test/', text: 'How to fix it' },
            { link: 'https://bare.test/', text: '' },
          ],
        },
        'https://rule.test/',
      )?.links,
    ).toEqual([
      { url: 'https://fix.test/', text: 'How to fix it' },
      { url: 'https://bare.test/', text: 'https://bare.test/' },
    ]);
  });

  it('drops links that are not plain http(s), and keeps at most five', () => {
    const finding = findingOf('r', 'm', {
      severity: Severity.error,
      documentation: [
        { link: 'javascript:alert(1)', text: 'x' },
        ...Array.from({ length: 8 }, (_, i) => ({
          link: `https://a.test/${i}`,
          text: `${i}`,
        })),
      ],
    });
    expect(finding?.links?.map((link) => link.text)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('leaves out the links when there are none', () => {
    expect(
      findingOf('r', 'm', { severity: Severity.error }),
    ).not.toHaveProperty('links');
  });

  it('cuts a long snippet off at 2000 characters', () => {
    const finding = findingOf('r', 'm', {
      severity: Severity.error,
      codeSnippet: 'x'.repeat(5000),
    });
    expect(finding?.snippet).toHaveLength(2000);
  });
});

describe('statusOf', () => {
  const finding = (level: 'error' | 'warning' | 'hint') => ({
    resource: 'r',
    message: 'm',
    level,
  });

  it('fails a hint with any error', () => {
    expect(statusOf([finding('warning'), finding('error')])).toBe('failed');
  });

  it('warns for a hint with warnings and no errors', () => {
    expect(statusOf([finding('hint'), finding('warning')])).toBe('warned');
  });

  it('passes a hint with nothing worse than a hint', () => {
    expect(statusOf([finding('hint')])).toBe('passed');
    expect(statusOf([])).toBe('passed');
  });
});

describe('loadPage', () => {
  it('follows redirects to the page it ends up on and parses it', async () => {
    const loaded = await page();
    expect(loaded.url).toBe('https://example.com/');
    expect(loaded.data.response.url).toBe('https://www.example.com/');
    expect(loaded.data.response.statusCode).toBe(200);
    expect(loaded.document.querySelectorAll('img')).toHaveLength(1);
  });

  it('throws when the page itself cannot be fetched', async () => {
    const down: Relay = () => Promise.reject(new TypeError('network down'));
    await expect(page(down)).rejects.toThrow('network down');
  });
});

describe('runHint', () => {
  it('emits the events in the order webhint does', async () => {
    const seen: string[] = [];
    await run(
      fake('order', (context) => {
        (
          [
            'scan::start',
            'fetch::end::html',
            'traverse::end',
            'scan::end',
          ] as const
        ).forEach((name) => context.on(name, () => void seen.push(name)));
      }),
    );
    expect(seen).toEqual([
      'scan::start',
      'fetch::end::html',
      'traverse::end',
      'scan::end',
    ]);
  });

  it('gives the hint the page headers, content and parsed document', async () => {
    const outcome = await run(
      fake('page', (context) => {
        context.on('traverse::end', (event) => {
          const img = event.document.querySelectorAll('img')[0];
          context.report(event.resource, 'Image without alt', {
            severity: Severity.error,
            element: img ?? null,
          });
          context.report(
            event.resource,
            `Frame: ${context.pageHeaders?.['x-frame-options'] ?? ''}, ${
              context.pageContent?.includes('<title>Hi</title>') ? 'has' : 'no'
            } title`,
            { severity: Severity.hint },
          );
        });
      }),
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.findings).toEqual([
      {
        resource: 'https://www.example.com/',
        message: 'Image without alt',
        level: 'error',
        snippet: '<img src="/a.png">',
        language: 'html',
        line: 4,
        column: 7,
      },
      {
        resource: 'https://www.example.com/',
        message: 'Frame: DENY, has title',
        level: 'hint',
      },
    ]);
  });

  it('passes a hint that reports nothing', async () => {
    expect(
      await run(
        fake('quiet', (context) => context.on('scan::end', () => undefined)),
      ),
    ).toMatchObject({ name: 'Hint quiet', status: 'passed', findings: [] });
  });

  it('lets the hint fetch other resources', async () => {
    const outcome = await run(
      fake('robots', (context) =>
        context.on('scan::end', async () => {
          const data = await context.fetchContent(
            'https://example.com/robots.txt',
          );
          context.report('r', data.response.body.content, {
            severity: Severity.hint,
          });
        }),
      ),
    );
    expect(outcome.findings[0]?.message).toBe('User-agent: *');
  });

  it('skips a hint that needs the browser to run script', async () => {
    expect(
      await run(
        fake('script', (context) =>
          context.on('traverse::end', async () => {
            await context.evaluate('1');
          }),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'Needs a browser to run script in the page.',
    });
  });

  it('skips the hints whose whole check is script, even if they swallow the refusal', async () => {
    expect(
      await run(
        fake('agent-webmcp', (context) =>
          context.on('scan::end', () =>
            context.report('r', 'Could not evaluate', {
              severity: Severity.warning,
            }),
          ),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'Needs a browser: it runs script in the page.',
      findings: [],
    });
  });

  it('skips a hint that tried to open a socket, even if it caught the refusal', async () => {
    expect(
      await run(
        fake('tls', (context) =>
          context.on('scan::end', async () => {
            await Promise.resolve();
            try {
              refuse('socket', 'open a TLS connection it can inspect');
            } catch {
              context.report('r', 'No TLS connection could be made', {
                severity: Severity.error,
              });
            }
          }),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason:
        'Needs the full scanner: it opens raw connections or runs programs, which a browser cannot.',
      findings: [],
    });
  });

  it('skips a hint that needed a certificate or key parsed', async () => {
    expect(
      await run(
        fake('dkim', (context) =>
          context.on('scan::end', () => {
            try {
              refuse('crypto', 'parse a public key synchronously');
            } catch {
              // The hint carries on without the key.
            }
          }),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason:
        'Needs the full scanner: it reads certificates or keys a browser cannot parse.',
    });
  });

  it('does not count a refusal made before the hint started against it', async () => {
    try {
      refuse('socket', 'open a raw TCP connection');
    } catch {
      // Left over from an earlier hint.
    }
    expect(
      (
        await run(
          fake('plain', (context) => context.on('scan::end', () => undefined)),
        )
      ).status,
    ).toBe('passed');
  });

  it('skips a hint that throws while it runs', async () => {
    expect(
      await run(
        fake('broken', (context) =>
          context.on('scan::end', () => {
            throw new Error('boom');
          }),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'Needs the full scanner: it uses something a browser cannot do.',
    });
  });

  it('skips a hint that throws while it is set up', async () => {
    expect(
      (
        await run(
          fake('unbuilt', () => {
            throw new Error('boom');
          }),
        )
      ).status,
    ).toBe('skipped');
  });

  it('skips a hint that takes too long', async () => {
    expect(
      await run(
        fake('slow', (context) =>
          context.on('scan::end', () => new Promise(() => undefined)),
        ),
        site(),
        1000,
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'Took longer than 1 seconds.',
    });
  });

  it('skips a hint that only listens for resources a browser loads', async () => {
    expect(
      await run(
        fake('scripts', (context) =>
          context.on('fetch::end::script', () => undefined),
        ),
      ),
    ).toMatchObject({
      status: 'skipped',
      reason: 'Needs a browser: it checks resources only a browser loads.',
    });
  });
});
