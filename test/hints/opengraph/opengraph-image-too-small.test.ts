import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-too-small.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-too-small', () => {
  it('passes at 1200x630', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="/i.svg">', {
          '/i.svg': {
            headers: { 'content-type': 'image/svg+xml' },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><!----></svg>',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('passes at 400x256', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="/i.svg">', {
          '/i.svg': {
            headers: { 'content-type': 'image/svg+xml' },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="256"><!----></svg>',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('reports 399x256', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="399" height="256"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('399x256');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/og-image-too-small',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports 400x255', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="255"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('400x255');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/og-image-too-small',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('passes without og:image', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
