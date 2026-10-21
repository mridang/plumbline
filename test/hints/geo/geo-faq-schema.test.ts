import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/geo/geo-faq-schema.js';
import { runHint } from '../../helpers/run-hint.js';

/** Serves a page whose <head> holds the given JSON-LD blocks and whose body is `body`. */
const page = (blocks: string[], body = '<h1>Heading</h1>') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${blocks
      .map((b) => `<script type="application/ld+json">${b}</script>`)
      .join('')}</head><body>${body}</body></html>`,
  },
});

describe('geo-faq-schema', () => {
  it('passes with a FAQPage', async () => {
    expect(await runHint(hint, page(['{"@type":"FAQPage"}']))).toEqual([]);
  });
  it('passes with FAQPage inside a @graph', async () => {
    expect(
      await runHint(hint, page(['{"@graph":[{"@type":"FAQPage"}]}'])),
    ).toEqual([]);
  });
  it('passes with an array @type', async () => {
    expect(
      await runHint(hint, page(['{"@type":["WebPage","FAQPage"]}'])),
    ).toEqual([]);
  });
  it('passes with FAQPage in one of several blocks', async () => {
    expect(
      await runHint(hint, page(['{oops', '[{"@type":"FAQPage"}]'])),
    ).toEqual([]);
  });
  it('warns with no JSON-LD', async () => {
    const problems = await runHint(hint, page([]));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No FAQPage');
  });
  it('warns with other types only', async () => {
    const problems = await runHint(hint, page(['{"@type":"WebPage"}']));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No FAQPage');
  });
  it('ignores invalid blocks', async () => {
    const problems = await runHint(hint, page(['{oops']));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No FAQPage');
  });
});
