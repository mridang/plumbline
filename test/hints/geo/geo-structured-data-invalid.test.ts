import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/geo/geo-structured-data-invalid.js';
import { runHint } from '../../helpers/run-hint.js';

/** Serves a page whose <head> holds one JSON-LD script per given text. */
const page = (blocks: string[]) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${blocks
      .map((b) => `<script type="application/ld+json">${b}</script>`)
      .join('')}</head><body><h1>Heading</h1></body></html>`,
  },
});

describe('geo-structured-data-invalid', () => {
  it('passes with valid JSON-LD', async () => {
    expect(await runHint(hint, page(['{"@type":"WebPage"}']))).toEqual([]);
  });

  it('passes with no JSON-LD at all', async () => {
    expect(await runHint(hint, page([]))).toEqual([]);
  });

  it('reports an invalid block as an error', async () => {
    const problems = await runHint(hint, page(['{oops']));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('1 of 1 JSON-LD block(s)');
  });

  it('counts invalid blocks among valid ones', async () => {
    const problems = await runHint(hint, page(['{"a":1}', '{oops', '{"b":2}']));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1 of 3');
  });

  it('counts an empty block as invalid', async () => {
    const problems = await runHint(hint, page(['']));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1 of 1');
  });

  it('points at the first invalid block', async () => {
    const problems = await runHint(hint, page(['{"ok":1}', '{oops']));
    expect(problems[0].sourceCode).toContain('{oops');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
