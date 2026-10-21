import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/public-key-pins.js';
import { runHint } from '../../helpers/run-hint.js';

describe('public-key-pins', () => {
  it('passes when the header is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports the deprecated header', async () => {
    const problems = await runHint(hint, {
      '/': { headers: { 'public-key-pins': 'pin-sha256=abc; max-age=100' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      'Public-Key-Pins: pin-sha256=abc; max-age=100',
    );
    expect(problems[0]?.message).toContain(
      "The 'Public-Key-Pins' header is deprecated",
    );
  });
});
