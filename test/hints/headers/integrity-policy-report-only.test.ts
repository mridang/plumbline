import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/integrity-policy-report-only.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('integrity-policy-report-only', () => {
  it('passes with a blocked-destinations list', async () => {
    expect(
      await runHint(
        hint,
        page({
          'integrity-policy-report-only': 'blocked-destinations=(script)',
        }),
      ),
    ).toEqual([]);
  });

  it('warns on an empty blocked-destinations list', async () => {
    const problems = await runHint(
      hint,
      page({ 'integrity-policy-report-only': 'blocked-destinations=()' }),
    );
    expect(problems[0].message).toContain('empty');
  });
});
