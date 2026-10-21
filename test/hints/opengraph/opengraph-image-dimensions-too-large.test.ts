import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-dimensions-too-large.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-dimensions-too-large', () => {
  it('passes at 4096x4096', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="/i.svg">', {
          '/i.svg': {
            headers: { 'content-type': 'image/svg+xml' },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096"><!----></svg>',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('reports width 5000', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="2625"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('5000x2625');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/og-image-dimensions-too-large',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('reports height 4097', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="4097"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1200x4097');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/og-image-dimensions-too-large',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
