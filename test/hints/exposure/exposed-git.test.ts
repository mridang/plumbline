import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-git.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-git', () => {
  it('passes when /.git is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports an exposed HEAD', async () => {
    const problems = await runHint(hint, {
      '/.git/HEAD': { body: 'ref: refs/heads/master\n' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('.git directory is exposed');
    expect(problems[0].resource).toContain('/.git/HEAD');
  });

  it('falls back to /.git/config', async () => {
    const problems = await runHint(hint, {
      '/.git/config': {
        body: '[core]\n\trepositoryformatversion = 0\n',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/.git/config');
  });

  it('does not flag a SPA that returns index.html for /.git/HEAD', async () => {
    const page =
      '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>';
    expect(
      await runHint(hint, {
        '/.git/HEAD': { body: page },
        '/.git/config': { body: page },
      }),
    ).toEqual([]);
  });
});
