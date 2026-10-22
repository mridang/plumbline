import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/hreflang-valid-codes.js';
import { runHint } from '../../helpers/run-hint.js';

function routes(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}

describe('hreflang-valid-codes', () => {
  it('passes with valid codes', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" hreflang="en-US" href="https://x.test/">' +
          '<link rel="alternate" hreflang="x-default" href="https://x.test/">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports each invalid code', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" hreflang="en_US" href="https://x.test/">' +
          '<link rel="alternate" hreflang="english" href="https://x.test/">',
      ),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0].message).toContain('"en_US"');
    expect(problems[1].message).toContain('"english"');
  });
});
