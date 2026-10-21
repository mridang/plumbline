import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cache-control.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (value?: string) => ({
  '/': {
    headers: (value ? { 'cache-control': value } : {}) as Record<
      string,
      string
    >,
  },
});
const enforce = { hintOptions: { enforce: true } };

describe('cache-control', () => {
  it('does nothing unless enforce is on', async () => {
    expect(await runHint(hint, page())).toEqual([]);
    expect(await runHint(hint, page('public, max-age=600'))).toEqual([]);
  });

  it('passes no-store, max-age=0 when enforced', async () => {
    expect(await runHint(hint, page('no-store, max-age=0'), enforce)).toEqual(
      [],
    );
  });

  it('reports a missing header when enforced', async () => {
    const problems = await runHint(hint, page(), enforce);
    expect(problems[0]?.message).toContain('was not specified');
  });

  it('reports another value when enforced', async () => {
    const problems = await runHint(hint, page('public, max-age=600'), enforce);
    expect(problems[0]?.message).toContain("should be 'no-store, max-age=0'");
  });
});
