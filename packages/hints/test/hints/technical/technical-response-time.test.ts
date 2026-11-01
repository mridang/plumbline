import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-response-time.js';
import { runHint } from '../../helpers/run-hint.js';

describe('technical-response-time', () => {
  it('passes a fast response', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a slow response', async () => {
    const problems = await runHint(hint, {
      '/': () => {
        // Blocks the test server so the response is late.
        const until = Date.now() + 700;
        while (Date.now() < until) {
          // Waiting.
        }
        return {
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
        };
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('to respond');
  });
});
