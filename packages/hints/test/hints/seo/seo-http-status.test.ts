import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-http-status.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-http-status', () => {
  it('passes a 200', async () => {
    expect(await runHint(hint, htmlPage({}))).toEqual([]);
  });

  it('reports a 404', async () => {
    const problems = await runHint(hint, htmlPage({ status: 404 }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTTP 404');
  });
});
