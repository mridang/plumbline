import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-backup-files.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-backup-files', () => {
  it('passes when no backup file is served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a reachable PHP source backup', async () => {
    const problems = await runHint(hint, {
      '/index.php.bak': { body: '<?php $db = "secret"; ?>' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/index.php.bak');
  });

  it('reports a reachable zip archive', async () => {
    const problems = await runHint(hint, {
      '/backup.zip': { body: 'PK\u0003\u0004 archive bytes' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/backup.zip');
  });

  it('does not flag a SPA index.html returned for a backup path', async () => {
    expect(
      await runHint(hint, {
        '/index.php.bak': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });
});
