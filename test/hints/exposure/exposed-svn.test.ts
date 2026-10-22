import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-svn.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-svn', () => {
  it('passes when /.svn is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a legacy entries file', async () => {
    const problems = await runHint(hint, {
      '/.svn/entries': { body: '12\n\ndir\n' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/.svn/entries');
  });

  it('falls back to the wc.db SQLite database', async () => {
    const problems = await runHint(hint, {
      '/.svn/wc.db': { body: 'SQLite format 3\u0000rest of file' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/.svn/wc.db');
  });

  it('does not flag a SPA index.html returned for /.svn/entries', async () => {
    expect(
      await runHint(hint, {
        '/.svn/entries': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });
});
