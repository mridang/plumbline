import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-redirect-chain.js';
import { runHint } from '../../helpers/run-hint.js';

/** Routes for a valid page whose head and body are filled in by the test. */
const page = (body: string, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`,
  },
});

describe('technical-redirect-chain', () => {
  it('passes without redirects', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
