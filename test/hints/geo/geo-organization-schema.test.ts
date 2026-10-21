import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/geo/geo-organization-schema.js';
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

describe('geo-organization-schema', () => {
  it('passes with an Organization and sameAs', async () => {
    expect(
      await runHint(
        hint,
        page(['{"@type":"Organization","sameAs":["https://x.example/a"]}']),
      ),
    ).toEqual([]);
  });
  it('passes with a Person in a @graph and a string sameAs', async () => {
    expect(
      await runHint(
        hint,
        page([
          '{"@graph":[{"@type":"Person","sameAs":"https://x.example/a"}]}',
        ]),
      ),
    ).toEqual([]);
  });
  it('warns with no entity', async () => {
    const problems = await runHint(hint, page(['{"@type":"WebPage"}']));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain(
      'No Organization/Corporation/LocalBusiness/Person',
    );
  });
  it('warns with no JSON-LD', async () => {
    const problems = await runHint(hint, page([]));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('No Organization');
  });
  it('warns without sameAs', async () => {
    const problems = await runHint(hint, page(['{"@type":"Organization"}']));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('no sameAs');
  });
  it('warns with an empty sameAs', async () => {
    const problems = await runHint(
      hint,
      page(['{"@type":"LocalBusiness","sameAs":[]}']),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('no sameAs');
  });
});
