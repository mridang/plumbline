import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/reporting-endpoints.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('reporting-endpoints', () => {
  it('passes for a valid map', async () => {
    expect(
      await runHint(
        hint,
        page({ 'reporting-endpoints': 'csp="https://e.test/r"' }),
      ),
    ).toEqual([]);
  });

  it('warns on a non-https endpoint', async () => {
    const problems = await runHint(
      hint,
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      page({ 'reporting-endpoints': 'csp="http://e.test/r"' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('https');
  });
});
