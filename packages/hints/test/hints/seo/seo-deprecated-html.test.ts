import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-deprecated-html.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-deprecated-html', () => {
  it('passes modern markup', async () => {
    expect(await runHint(hint, htmlPage({}))).toEqual([]);
  });

  it('reports obsolete elements', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<center>old</center><font>old</font>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('<center> (1), <font> (1)');
  });
});
