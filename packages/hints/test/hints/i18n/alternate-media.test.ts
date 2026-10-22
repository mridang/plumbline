import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/alternate-media.js';
import { runHint } from '../../helpers/run-hint.js';

function routes(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}

describe('alternate-media', () => {
  it('passes a well-formed media alternate', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" media="only screen and (max-width: 640px)" href="https://m.x.test/">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports an empty media query', async () => {
    const problems = await runHint(
      hint,
      routes('<link rel="alternate" media="" href="https://m.x.test/">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('non-empty media query');
  });

  it('reports a non-absolute href', async () => {
    const problems = await runHint(
      hint,
      routes('<link rel="alternate" media="print" href="/print">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
    );
  });
});
