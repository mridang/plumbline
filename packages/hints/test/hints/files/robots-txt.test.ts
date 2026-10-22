import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/files/robots-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/plain; charset=utf-8',
  status = 200,
) => ({
  '/robots.txt': { status, headers: { 'content-type': type }, body },
});

describe('robots-txt', () => {
  it('passes for a valid file', async () => {
    expect(
      await runHint(
        hint,
        serve(
          `User-agent: *\nDisallow: /private/\nSitemap: https://a.com/s.xml\n`,
        ),
      ),
    ).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/robots.txt');
    expect(problems[0].sourceCode).toContain('Sitemap:');
  });

  it('reports a 404 served by the route', async () => {
    const problems = await runHint(hint, serve('nope', 'text/plain', 404));
    expect(problems[0].message).toContain('HTTP 404');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve(
        `User-agent: *\nDisallow: /private/\nSitemap: https://a.com/s.xml\n`,
        'text/html; charset=utf-8',
      ),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/html'",
    );
  });

  it('reports a non UTF-8 charset', async () => {
    const problems = await runHint(
      hint,
      serve(
        `User-agent: *\nDisallow: /private/\nSitemap: https://a.com/s.xml\n`,
        'text/plain; charset=iso-8859-1',
      ),
    );
    expect(problems.map((p) => p.message).join()).toContain('UTF-8');
  });

  it('reports an invalid file with a line number', async () => {
    const problems = await runHint(
      hint,
      serve(`User-agent: *\nDisallow: private\n`),
    );
    const problem = problems.find((p) =>
      p.message.includes("must start with '/'"),
    );
    expect(problem?.resource).toContain('/robots.txt');
    expect(problem?.sourceCode).toContain('Disallow: private');
    expect(problem?.location.line).toBe(1);
  });
});
