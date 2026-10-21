import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-broken.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-broken', () => {
  it('passes with a real image', async () => {
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

  it('passes without og:image', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('reports a 404', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('HTTP 404');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/broken-og-image',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports a non-image response', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.svg">', {
        '/i.svg': {
          headers: { 'content-type': 'text/html' },
          body: '<html></html>',
        },
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not an image');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/broken-og-image',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports an unreachable image', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="http://127.0.0.1:1/i.png">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('could not be fetched');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/broken-og-image',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports the image URL and carries the og:image tag', async () => {
    const [problem] = await runHint(
      hint,
      page('<meta property="og:image" content="/gone">', {
        '/gone': {
          status: 404,
          headers: { 'content-type': 'text/plain' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        },
      }),
    );
    expect(problem.resource.endsWith('/gone')).toBe(true);
    expect(problem.sourceCode).toContain(
      '<meta property="og:image" content="/gone">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
