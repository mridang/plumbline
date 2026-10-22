import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/retry-after.js';
import { runHint } from '../../helpers/run-hint.js';

describe('retry-after', () => {
  it('is not applicable on a 200 response', async () => {
    const problems = await runHint(hint, {
      '/': {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'retry-after': 'soon',
        },
        body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
      },
    });
    expect(problems).toEqual([]);
  });

  it('warns on a malformed value on a 503 response', async () => {
    const problems = await runHint(hint, {
      '/': {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'retry-after': 'soon',
        },
        body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Retry-After: soon');
  });

  it('accepts delta-seconds on a 503 response', async () => {
    const problems = await runHint(hint, {
      '/': {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'retry-after': '120',
        },
        body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
      },
    });
    expect(problems).toEqual([]);
  });
});
