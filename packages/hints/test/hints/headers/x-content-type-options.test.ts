import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-content-type-options.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string> = {}) => ({ '/': { headers } });

describe('x-content-type-options', () => {
  it('passes nosniff', async () => {
    expect(
      await runHint(hint, page({ 'x-content-type-options': 'nosniff' })),
    ).toEqual([]);
  });

  it('reports a missing header with the value to add', async () => {
    const problems = await runHint(hint, page());
    expect(problems[0].message).toContain('was not specified');
    expect(problems[0].sourceCode).toBe('X-Content-Type-Options: nosniff');
  });

  it('reports another value', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-content-type-options': 'sniff' }),
    );
    expect(problems[0].message).toContain("should be 'nosniff'");
  });
});
