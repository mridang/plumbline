import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-permitted-cross-domain-policies.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string> = {}) => ({ '/': { headers } });

describe('x-permitted-cross-domain-policies', () => {
  it('passes none', async () => {
    expect(
      await runHint(
        hint,
        page({ 'x-permitted-cross-domain-policies': 'none' }),
      ),
    ).toEqual([]);
  });

  it('reports a missing header', async () => {
    const problems = await runHint(hint, page());
    expect(problems[0]?.message).toContain('was not specified');
  });

  it('reports another value', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-permitted-cross-domain-policies': 'master-only' }),
    );
    expect(problems[0]?.message).toContain("should be 'none'");
  });
});
