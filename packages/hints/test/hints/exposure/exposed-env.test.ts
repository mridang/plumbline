import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-env.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-env', () => {
  it('passes when /.env is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a readable .env with secrets', async () => {
    const problems = await runHint(hint, {
      '/.env': { body: 'DB_PASSWORD=secret\nAPI_KEY=abc123\n' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('/.env');
    expect(problems[0].resource).toContain('/.env');
  });

  it('does not flag a SPA index.html returned for /.env', async () => {
    expect(
      await runHint(hint, {
        '/.env': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });

  it('does not flag a 404', async () => {
    expect(
      await runHint(hint, { '/.env': { status: 404, body: 'nope' } }),
    ).toEqual([]);
  });
});
