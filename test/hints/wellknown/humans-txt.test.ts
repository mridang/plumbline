import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/wellknown/humans-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (type = 'text/plain; charset=utf-8', status = 200) => ({
  '/humans.txt': {
    status,
    headers: { 'content-type': type },
    body: '/* TEAM */\nDeveloper: Me\n',
  },
});

describe('humans-txt', () => {
  it('passes for a plain-text file', async () => {
    expect(await runHint(hint, serve())).toEqual([]);
  });

  it('reports a missing file at hint severity', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(hint, serve('text/html; charset=utf-8'));
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/html'",
    );
  });
});
