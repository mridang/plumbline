import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-ds-store.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-ds-store', () => {
  it('passes when /.DS_Store is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a file with the .DS_Store signature', async () => {
    const problems = await runHint(hint, {
      '/.DS_Store': { body: '\u0000\u0000\u0000\u0001Bud1 padding bytes here' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/.DS_Store');
  });

  it('does not flag a SPA index.html returned for /.DS_Store', async () => {
    expect(
      await runHint(hint, {
        '/.DS_Store': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });
});
