import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/app-ads-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/plain; charset=utf-8',
  status = 200,
) => ({ '/app-ads.txt': { status, headers: { 'content-type': type }, body } });

describe('app-ads-txt', () => {
  it('passes for a valid file', async () => {
    expect(await runHint(hint, serve('example.com, 1, DIRECT'))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/app-ads.txt');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve('example.com, 1, DIRECT', 'application/json'),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'application/json'",
    );
  });

  it('reports a malformed record', async () => {
    const problems = await runHint(hint, serve('example.com'));
    expect(problems.map((p) => p.message).join()).toContain('Malformed record');
  });
});
