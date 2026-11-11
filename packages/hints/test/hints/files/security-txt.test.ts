import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/files/security-txt.js';
import { runHint } from '../../helpers/run-hint.js';

const serve = (
  body: string,
  type = 'text/plain; charset=utf-8',
  status = 200,
) => ({
  '/.well-known/security.txt': {
    status,
    headers: { 'content-type': type },
    body,
  },
});

// Six months ahead, so the file is neither expired nor over a year away.
const EXPIRES = new Date(Date.now() + 182 * 86_400_000).toISOString();

describe('security-txt', () => {
  it('passes for a valid file', async () => {
    expect(
      await runHint(
        hint,
        serve(`Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`),
      ),
    ).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain('/.well-known/security.txt');
    expect(problems[0].sourceCode).toContain('Contact: mailto:');
  });

  it('reports a 404 served by the route', async () => {
    const problems = await runHint(hint, serve('nope', 'text/plain', 404));
    expect(problems[0].message).toContain('HTTP 404');
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(
      hint,
      serve(
        `Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`,
        'text/html; charset=utf-8',
      ),
    );
    expect(problems.map((p) => p.message).join(',')).toContain(
      "served as 'text/html'",
    );
  });

  it('reports a non UTF-8 charset', async () => {
    const problems = await runHint(
      hint,
      serve(
        `Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`,
        'text/plain; charset=iso-8859-1',
      ),
    );
    expect(problems.map((p) => p.message).join(',')).toMatch(/UTF-8/);
  });

  it('reports an invalid file with a line number', async () => {
    const problems = await runHint(hint, serve(`Contact: mailto:s@a.com\n`));
    expect(problems.map((p) => p.message).join(',')).toContain(
      "'Expires' field is missing",
    );
  });

  it('reports a file found only at the legacy location', async () => {
    const problems = await runHint(hint, {
      '/security.txt': {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: `Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`,
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('legacy location');
  });

  it('still validates a legacy file', async () => {
    const problems = await runHint(hint, {
      '/security.txt': {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'Contact: mailto:s@a.com\n',
      },
    });
    expect(problems.map((p) => p.message).join(',')).toContain("'Expires'");
  });

  it('prefers the well-known file over the legacy one', async () => {
    const problems = await runHint(hint, {
      ...serve(`Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`),
      '/security.txt': { body: 'ignored' },
    });
    expect(problems).toEqual([]);
  });

  // The test server is plain HTTP on 127.0.0.1; passing proves the loopback
  // exemption, since a non-loopback HTTP host would report an HTTPS error.
  it('does not require HTTPS on a loopback host', async () => {
    const problems = await runHint(
      hint,
      serve(`Contact: mailto:s@a.com\nExpires: ${EXPIRES}\n`),
    );
    expect(problems.map((p) => p.message).join(',')).not.toContain('HTTPS');
  });
});
