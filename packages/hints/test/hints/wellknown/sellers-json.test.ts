import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/sellers-json.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'application/json; charset=utf-8',
  status = 200,
) => ({ '/sellers.json': { status, headers: { 'content-type': type }, body } });

const valid = JSON.stringify({
  version: '1.0',
  sellers: [
    { seller_id: '1', seller_type: 'PUBLISHER', name: 'A', domain: 'a.com' },
  ],
});

describe('sellers-json', () => {
  it('passes for a valid file', async () => {
    expect(await runHint(hint, serve(valid))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/sellers.json');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(hint, serve(valid, 'text/plain'));
    expect(problems.map((p) => p.message).join(',')).toContain(
      "served as 'text/plain'",
    );
  });

  it('reports invalid JSON', async () => {
    const problems = await runHint(hint, serve('{ broken'));
    expect(problems.map((p) => p.message).join(',')).toContain(
      'not valid JSON',
    );
  });

  it('reports a missing version', async () => {
    const problems = await runHint(
      hint,
      serve(JSON.stringify({ sellers: [] })),
    );
    expect(problems.map((p) => p.message).join(',')).toContain(
      "'version' field is missing",
    );
  });
});
