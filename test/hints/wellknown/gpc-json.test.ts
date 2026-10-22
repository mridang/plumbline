import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/gpc-json.js';
import { runHint } from '../../helpers/run-hint.js';

const PATH = '/.well-known/gpc.json';

const serve = (
  body: string,
  type = 'application/json; charset=utf-8',
  status = 200,
) => ({ [PATH]: { status, headers: { 'content-type': type }, body } });

const valid = JSON.stringify({ gpc: true, lastUpdate: '2026-01-01' });

describe('gpc-json', () => {
  it('passes for a valid file', async () => {
    expect(await runHint(hint, serve(valid))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain(PATH);
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(hint, serve(valid, 'text/plain'));
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/plain'",
    );
  });

  it('reports invalid JSON', async () => {
    const problems = await runHint(hint, serve('nope'));
    expect(problems.map((p) => p.message).join()).toContain('not valid JSON');
  });

  it('reports a non-boolean gpc field', async () => {
    const problems = await runHint(
      hint,
      serve(JSON.stringify({ gpc: 'yes', lastUpdate: '2026-01-01' })),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      "'gpc' field must be a boolean",
    );
  });
});
