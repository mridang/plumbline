import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/expect-ct.js';
import { runHint } from '../../helpers/run-hint.js';

describe('expect-ct', () => {
  it('passes when the header is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports the deprecated header', async () => {
    const problems = await runHint(hint, {
      '/': { headers: { 'expect-ct': 'max-age=86400, enforce' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe('Expect-CT: max-age=86400, enforce');
    expect(problems[0]?.message).toContain(
      "The 'Expect-CT' header is deprecated",
    );
  });
});
