import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/ads-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/plain; charset=utf-8',
  status = 200,
) => ({ '/ads.txt': { status, headers: { 'content-type': type }, body } });

describe('ads-txt', () => {
  it('passes for a valid file', async () => {
    expect(
      await runHint(
        hint,
        serve('example.com, 12345, DIRECT, f08c47fec0942fa0\n'),
      ),
    ).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/ads.txt');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve('example.com, 1, DIRECT', 'text/html; charset=utf-8'),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/html'",
    );
  });

  it('reports a malformed record with a line number', async () => {
    const problems = await runHint(hint, serve('example.com, 12345\n'));
    const malformed = problems.find((p) =>
      p.message.includes('Malformed record'),
    );
    expect(malformed).toBeDefined();
    expect(malformed?.location?.line).toBe(0);
  });

  it('reports an invalid relationship', async () => {
    const problems = await runHint(hint, serve('example.com, 1, PARTNER'));
    expect(problems.map((p) => p.message).join()).toContain(
      'must be DIRECT or RESELLER',
    );
  });
});
