import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/feature-policy.js';
import { runHint } from '../../helpers/run-hint.js';

describe('feature-policy', () => {
  it('passes when the header is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports the deprecated header', async () => {
    const problems = await runHint(hint, {
      '/': { headers: { 'feature-policy': 'camera none' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe('Feature-Policy: camera none');
    expect(problems[0]?.message).toContain(
      "The 'Feature-Policy' header is deprecated",
    );
  });
});
