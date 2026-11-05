import { describe, expect, it } from '@jest/globals';
import type { HintContext, NetworkData } from 'hint';
import { Severity } from '@hint/utils-types';
import type { CatalogueEntry, HintInfo } from '../../src/engine/catalogue.js';
import {
  findingOf,
  loadPage,
  runHint,
  skipped,
  statusOf,
  type FetchContent,
} from '../../src/engine/engine.js';

const INFO: HintInfo = {
  id: 'fake',
  name: 'Fake',
  description: '',
  reference: 'https://example.com/rule',
  section: 'headers',
  sectionTitle: 'Headers',
  sectionOrder: 1,
  groups: [],
  origins: [],
};

/** A hint class whose constructor runs `setup` with its context. */
function entry(
  setup: (context: HintContext) => void,
  info: Partial<HintInfo> = {},
): CatalogueEntry {
  return {
    info: { ...INFO, ...info },
    ctor: class {
      public constructor(context: HintContext) {
        setup(context);
      }
    },
  };
}

const data = (html: string): NetworkData =>
  ({
    request: { headers: {}, url: 'https://example.com/' },
    response: {
      body: { content: html, rawContent: Buffer.from(html) },
      charset: 'utf-8',
      headers: { server: 'x' },
      hops: [],
      mediaType: 'text/html',
      statusCode: 200,
      url: 'https://example.com/',
    },
  }) as unknown as NetworkData;

const fetchContent: FetchContent = async () => data('<html></html>');

const page = () =>
  loadPage(new URL('https://example.com/'), async () =>
    data('<html><head><title>t</title></head><body></body></html>'),
  );

describe('findingOf', () => {
  it('drops a finding switched off', () => {
    expect(
      findingOf('r', 'm', { severity: Severity.off }, undefined),
    ).toBeNull();
  });

  it('names the level of each severity', () => {
    const level = (severity: Severity) =>
      findingOf('r', 'm', { severity })?.level;
    expect(level(Severity.error)).toBe('error');
    expect(level(Severity.warning)).toBe('warning');
    expect(level(Severity.hint)).toBe('hint');
    expect(level(Severity.information)).toBe('information');
  });

  it('carries the snippet, its language and a one-based place', () => {
    expect(
      findingOf('r', 'm', {
        severity: Severity.error,
        codeSnippet: 'Server: x',
        codeLanguage: 'http',
        location: { line: 0, column: 4 },
      }),
    ).toEqual({
      resource: 'r',
      message: 'm',
      level: 'error',
      snippet: 'Server: x',
      language: 'http',
      line: 1,
      column: 5,
    });
  });

  it('takes the snippet and place from an element', async () => {
    const { document } = await page();
    const title = document.querySelectorAll('title')[0];
    const finding = findingOf('r', 'm', {
      severity: Severity.warning,
      element: title,
    });
    expect(finding?.snippet).toBe('<title>t</title>');
    expect(finding?.language).toBe('html');
    expect(finding?.line).toBeGreaterThan(0);
  });

  it('keeps only http(s) links other than the hint reference, at most five', () => {
    const documentation = [
      { link: 'https://example.com/rule', text: 'the rule' },
      { link: 'javascript:alert(1)', text: 'bad' },
      ...Array.from({ length: 7 }, (_, i) => ({
        link: `https://example.com/${i}`,
        text: '',
      })),
    ];
    const finding = findingOf(
      'r',
      'm',
      { severity: Severity.error, documentation },
      'https://example.com/rule',
    );
    expect(finding?.links).toHaveLength(5);
    expect(finding?.links?.[0]).toEqual({
      url: 'https://example.com/0',
      text: 'https://example.com/0',
    });
  });

  it('cuts a very long snippet', () => {
    const finding = findingOf('r', 'm', {
      severity: Severity.error,
      codeSnippet: 'x'.repeat(5000),
    });
    expect(finding?.snippet).toHaveLength(2000);
  });
});

describe('statusOf', () => {
  it('is the worst level found', () => {
    const f = (level: 'error' | 'warning' | 'hint') => ({
      resource: 'r',
      message: 'm',
      level,
    });
    expect(statusOf([])).toBe('passed');
    expect(statusOf([f('hint')])).toBe('passed');
    expect(statusOf([f('hint'), f('warning')])).toBe('warned');
    expect(statusOf([f('warning'), f('error')])).toBe('failed');
  });
});

describe('runHint', () => {
  it('passes a hint that reports nothing', async () => {
    const outcome = await runHint(
      entry((context) => context.on('fetch::end::html', () => undefined)),
      await page(),
      fetchContent,
    );
    expect(outcome).toMatchObject({
      id: 'fake',
      status: 'passed',
      findings: [],
    });
  });

  it('fails a hint that reports an error, with the events in order', async () => {
    const seen: string[] = [];
    const outcome = await runHint(
      entry((context) => {
        for (const name of [
          'scan::start',
          'fetch::end::html',
          'traverse::end',
          'scan::end',
        ] as const) {
          context.on(name, () => {
            seen.push(name);
            if (name === 'fetch::end::html') {
              context.report('https://example.com/', 'broken', {
                severity: Severity.error,
              });
            }
          });
        }
      }),
      await page(),
      fetchContent,
    );
    expect(seen).toEqual([
      'scan::start',
      'fetch::end::html',
      'traverse::end',
      'scan::end',
    ]);
    expect(outcome.status).toBe('failed');
    expect(outcome.findings).toEqual([
      { resource: 'https://example.com/', message: 'broken', level: 'error' },
    ]);
  });

  it('warns for a hint that reports a warning', async () => {
    const outcome = await runHint(
      entry((context) =>
        context.on('scan::end', () =>
          context.report('r', 'meh', { severity: Severity.warning }),
        ),
      ),
      await page(),
      fetchContent,
    );
    expect(outcome.status).toBe('warned');
  });

  it('hands a hint the page and its fetchContent', async () => {
    let body = '';
    let headers: unknown;
    await runHint(
      entry((context) =>
        context.on('scan::end', async () => {
          headers = context.pageHeaders;
          body = (await context.fetchContent('https://example.com/x')).response
            .body.content;
        }),
      ),
      await page(),
      fetchContent,
    );
    expect(headers).toEqual({ server: 'x' });
    expect(body).toBe('<html></html>');
  });

  it('skips a hint that throws, keeping what it found', async () => {
    const outcome = await runHint(
      entry((context) =>
        context.on('fetch::end::html', () => {
          context.report('r', 'found', { severity: Severity.warning });
          throw new Error('boom');
        }),
      ),
      await page(),
      fetchContent,
    );
    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toBe('It could not finish: it threw an error.');
    expect(outcome.findings).toHaveLength(1);
  });

  it('skips a hint whose constructor throws', async () => {
    const outcome = await runHint(
      entry(() => {
        throw new Error('no');
      }),
      await page(),
      fetchContent,
    );
    expect(outcome.status).toBe('skipped');
  });

  it('skips a hint that runs out of time', async () => {
    const outcome = await runHint(
      entry((context) =>
        context.on('scan::end', () => new Promise(() => undefined)),
      ),
      await page(),
      fetchContent,
      30,
    );
    expect(outcome).toMatchObject({
      status: 'skipped',
      reason: 'Took longer than 0 seconds.',
    });
  });

  it('skips a hint that asks the page to run script', async () => {
    const outcome = await runHint(
      entry((context) => context.on('scan::end', () => context.evaluate('1'))),
      await page(),
      fetchContent,
    );
    expect(outcome).toMatchObject({
      status: 'skipped',
      reason: 'Needs a browser to run script in the page.',
    });
  });

  it.each(['agent-webmcp', 'privacy-local-storage'])(
    'skips %s, which is script in the page',
    async (id) => {
      const outcome = await runHint(
        entry((context) => context.on('scan::end', () => undefined), { id }),
        await page(),
        fetchContent,
      );
      expect(outcome).toMatchObject({
        status: 'skipped',
        reason: 'Needs a browser: it runs script in the page.',
      });
    },
  );

  it('skips a hint that listens only to resources a browser loads', async () => {
    const outcome = await runHint(
      entry((context) =>
        context.on('fetch::end::script' as 'scan::end', () => undefined),
      ),
      await page(),
      fetchContent,
    );
    expect(outcome).toMatchObject({
      status: 'skipped',
      reason: 'Needs a browser: it checks resources only a browser loads.',
    });
  });
});

describe('skipped', () => {
  it('is the hint with a reason', () => {
    expect(skipped(INFO, 'why')).toMatchObject({
      id: 'fake',
      status: 'skipped',
      reason: 'why',
      findings: [],
    });
  });
});

describe('loadPage', () => {
  it('fetches and parses the page once', async () => {
    const loaded = await page();
    expect(loaded.url).toBe('https://example.com/');
    expect(loaded.document.querySelectorAll('title')).toHaveLength(1);
  });
});
