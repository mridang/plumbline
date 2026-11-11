import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/files/ai-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/plain; charset=utf-8',
  status = 200,
) => ({
  '/ai.txt': { status, headers: { 'content-type': type }, body },
});

describe('ai-txt', () => {
  it('passes for a valid file', async () => {
    expect(
      await runHint(hint, serve(`User-Agent: *\nDisallow: images\n`)),
    ).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/ai.txt');
    expect(problems[0].sourceCode).toContain('User-agent');
  });

  it('reports a 404 served by the route', async () => {
    const problems = await runHint(hint, serve('nope', 'text/plain', 404));
    expect(problems[0].message).toContain('HTTP 404');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve(`User-Agent: *\nDisallow: images\n`, 'text/html; charset=utf-8'),
    );
    expect(problems.map((p) => p.message).join(',')).toContain(
      "served as 'text/html'",
    );
  });

  it('reports a non UTF-8 charset', async () => {
    const problems = await runHint(
      hint,
      serve(
        `User-Agent: *\nDisallow: images\n`,
        'text/plain; charset=iso-8859-1',
      ),
    );
    expect(problems.map((p) => p.message).join(',')).toContain('UTF-8');
  });

  it('reports an invalid file with a line number', async () => {
    const problems = await runHint(hint, serve(`Allow: images\n`));
    const problem = problems.find((p) =>
      p.message.includes('before any User-Agent'),
    );
    expect(problem?.resource).toContain('/ai.txt');
    expect(problem?.sourceCode).toContain('Allow: images');
    expect(problem?.location.line).toBe(0);
  });
});
