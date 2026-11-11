import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/files/llms-full-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/markdown; charset=utf-8',
  status = 200,
) => ({
  '/llms-full.txt': { status, headers: { 'content-type': type }, body },
});

describe('llms-full-txt', () => {
  it('passes for a valid file', async () => {
    expect(await runHint(hint, serve(`# A\n\ntext\n`))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/llms-full.txt');
    expect(problems[0].sourceCode).toContain('# ');
  });

  it('reports a 404 served by the route', async () => {
    const problems = await runHint(hint, serve('nope', 'text/plain', 404));
    expect(problems[0].message).toContain('HTTP 404');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve(`# A\n\ntext\n`, 'text/html; charset=utf-8'),
    );
    expect(problems.map((p) => p.message).join(',')).toContain(
      "served as 'text/html'",
    );
  });

  it('reports a non UTF-8 charset', async () => {
    const problems = await runHint(
      hint,
      serve(`# A\n\ntext\n`, 'text/markdown; charset=iso-8859-1'),
    );
    expect(problems.map((p) => p.message).join(',')).toMatch(/UTF-8/);
  });

  it('reports an invalid file with a line number', async () => {
    const problems = await runHint(hint, serve(`text only\n`));
    expect(problems.map((p) => p.message).join(',')).toContain('H1');
  });
});
