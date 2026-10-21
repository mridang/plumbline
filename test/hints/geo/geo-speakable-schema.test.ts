import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/geo/geo-speakable-schema.js';
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

describe('geo-speakable-schema', () => {
  it('passes with a SpeakableSpecification', async () => {
    expect(
      await runHint(hint, page(['{"@type":"SpeakableSpecification"}'])),
    ).toEqual([]);
  });
  it('passes with a speakable property', async () => {
    expect(
      await runHint(
        hint,
        page(['{"@type":"WebPage","speakable":{"cssSelector":["h1"]}}']),
      ),
    ).toEqual([]);
  });
  it('passes with speakable in a @graph', async () => {
    expect(
      await runHint(
        hint,
        page(['{"@graph":[{"speakable":{"@type":"SpeakableSpecification"}}]}']),
      ),
    ).toEqual([]);
  });
  it('warns with no JSON-LD', async () => {
    const problems = await runHint(hint, page([]));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No Speakable');
  });
  it('warns when speakable is empty', async () => {
    const problems = await runHint(
      hint,
      page(['{"@type":"WebPage","speakable":""}']),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No Speakable');
  });

  it('suggests a speakable block in the head', async () => {
    const problems = await runHint(hint, page([]));
    expect(problems[0].sourceCode).toContain('SpeakableSpecification');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
