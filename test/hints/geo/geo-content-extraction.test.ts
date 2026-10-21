import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/geo/geo-content-extraction.js';
import { runHint } from '../../helpers/run-hint.js';

/** Serves a page whose <body> is `body`. */
const page = (body: string) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>A fine page title</title></head><body>${body}</body></html>`,
  },
});

describe('geo-content-extraction', () => {
  it('passes with headings and paragraphs', async () => {
    expect(
      await runHint(hint, page(`<h1>Title</h1><p>${'a'.repeat(40)}</p>`)),
    ).toEqual([]);
  });

  it('passes with structure only inside <main>', async () => {
    expect(await runHint(hint, page('<main><h2>Title</h2></main>'))).toEqual(
      [],
    );
  });

  it('warns with no structure', async () => {
    const problems = await runHint(hint, page('<div>short</div>'));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No headings or paragraph-level');
  });

  it('ignores paragraphs of 30 characters or fewer', async () => {
    const problems = await runHint(hint, page(`<p>${'a'.repeat(30)}</p>`));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No headings or paragraph-level');
  });

  it('warns about an unstructured block over 800 characters', async () => {
    const problems = await runHint(
      hint,
      page(`<h1>T</h1><div>${'a'.repeat(801)}</div>`),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('801-character block');
  });

  it('passes with a block of exactly 800 characters', async () => {
    expect(
      await runHint(hint, page(`<h1>T</h1><div>${'a'.repeat(800)}</div>`)),
    ).toEqual([]);
  });
});
