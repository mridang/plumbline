import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-non-optimal-size.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-non-optimal-size', () => {
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

  it('passes at 1200x628', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="/i.svg">', {
          '/i.svg': {
            headers: { 'content-type': 'image/svg+xml' },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628"><!----></svg>',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('passes at 2400x1260', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="/i.svg">', {
          '/i.svg': {
            headers: { 'content-type': 'image/svg+xml' },
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1260"><!----></svg>',
          },
        }),
      ),
    ).toEqual([]);
  });

  it('reports a square image', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('800x800');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/non-optimal-image-size',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports a small 1.91:1 image', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="314"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('600x314');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/non-optimal-image-size',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports a near 1.91:1 image that is not an accepted size', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="654"><!----></svg>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1250x654');
  });

  it('reports the image URL and carries the og:image tag', async () => {
    const [problem] = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"></svg>',
        },
      }),
    );
    expect(problem.resource.endsWith('/i.svg')).toBe(true);
    expect(problem.sourceCode).toContain(
      '<meta property="og:image" content="/i.svg">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
