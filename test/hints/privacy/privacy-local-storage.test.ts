import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-local-storage.js';
import { runHint } from '../../helpers/run-hint.js';
import { setEvaluate } from '../../helpers/test-connector.js';

afterEach(() => {
  setEvaluate(() => {
    throw new Error('evaluate is not configured for this test');
  });
});

describe('privacy-local-storage', () => {
  it('passes when localStorage is empty', async () => {
    setEvaluate(() => '{}');
    expect(await runHint(hint)).toEqual([]);
  });

  it('passes when the browser cannot be asked', async () => {
    expect(await runHint(hint)).toEqual([]);
  });

  it('reports keys and truncated values', async () => {
    setEvaluate(() => JSON.stringify({ theme: 'dark', blob: 'x'.repeat(60) }));
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('localStorage used (2)');
    expect(problems[0].message).toContain('theme = dark');
    expect(problems[0].message).toContain(`${'x'.repeat(50)}...`);
  });
});
