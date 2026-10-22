import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/apple-app-site-association.js';
import { runHint } from '../../helpers/run-hint.js';

const EXPECTED = '/.well-known/apple-app-site-association';
const LEGACY = '/apple-app-site-association';

const valid = JSON.stringify({
  applinks: {
    details: [{ appIDs: ['ABCDE.com.example'], components: [{ '/': '/*' }] }],
  },
});

const at = (path: string, body: string, type = 'application/json') => ({
  [path]: { headers: { 'content-type': type }, body },
});

describe('apple-app-site-association', () => {
  it('passes for a valid well-known file', async () => {
    expect(await runHint(hint, at(EXPECTED, valid))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain(EXPECTED);
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(hint, at(EXPECTED, valid, 'text/plain'));
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/plain'",
    );
  });

  it('reports invalid JSON', async () => {
    const problems = await runHint(hint, at(EXPECTED, 'nope'));
    expect(problems.map((p) => p.message).join()).toContain('not valid JSON');
  });

  it('reports a file declaring no known service', async () => {
    const problems = await runHint(
      hint,
      at(EXPECTED, JSON.stringify({ x: 1 })),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      'declares none of applinks',
    );
  });

  it('flags a file found only at the legacy location', async () => {
    const problems = await runHint(hint, at(LEGACY, valid));
    expect(problems.map((p) => p.message).join()).toContain('legacy location');
  });
});
