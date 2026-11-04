import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-url-friendly.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-url-friendly', () => {
  it('passes a short lower-case URL', async () => {
    expect(await runHint(hint, htmlPage())).toEqual([]);
  });

  it('reports upper case and underscores', async () => {
    const path = '/My_Page';
    const problems = await runHint(hint, htmlPage({}, path), { path });
    expect(problems.map((p) => p.message).join(' ')).toContain('upper-case');
    expect(problems.map((p) => p.message).join(' ')).toContain('underscores');
    expect(problems[0].sourceCode).toContain(path);
  });
});
