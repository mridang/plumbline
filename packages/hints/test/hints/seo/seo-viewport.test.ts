import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-viewport.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-viewport', () => {
  it('passes a viewport', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({
          head: '<meta name="viewport" content="width=device-width, initial-scale=1">',
        }),
      ),
    ).toEqual([]);
  });

  it('reports a missing viewport', async () => {
    const problems = await runHint(hint, htmlPage({}));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no <meta name="viewport">');
  });

  it('reports blocked zooming', async () => {
    const problems = await runHint(
      hint,
      htmlPage({
        head: '<meta name="viewport" content="width=device-width, user-scalable=no">',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('zooming');
  });
});
