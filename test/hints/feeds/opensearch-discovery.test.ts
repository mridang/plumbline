import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/feeds/opensearch-discovery.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (head: string) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

describe('opensearch-discovery', () => {
  it('passes when an OpenSearch description is declared with an absolute href', async () => {
    const problems = await runHint(
      hint,
      page(
        '<link rel="search" type="application/opensearchdescription+xml" href="https://x.test/os.xml">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports a missing OpenSearch description at hint severity', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('No OpenSearch description');
  });

  it('warns about a relative OpenSearch href', async () => {
    const problems = await runHint(
      hint,
      page(
        '<link rel="search" type="application/opensearchdescription+xml" href="/os.xml">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
