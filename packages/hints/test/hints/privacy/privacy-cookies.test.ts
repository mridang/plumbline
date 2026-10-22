import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-cookies.js';
import { runHint } from '../../helpers/run-hint.js';
import { setEvaluate } from '../../helpers/test-connector.js';

afterEach(() => {
  setEvaluate(() => {
    throw new Error('evaluate is not configured for this test');
  });
});

const html = (body: string, headers: Record<string, string> = {}) => ({
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  body: `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`,
});

describe('privacy-cookies', () => {
  it('passes without cookies, even when evaluate is unavailable', async () => {
    expect(await runHint(hint, { '/': html('') })).toEqual([]);
  });

  it('reports first-party cookies as information', async () => {
    const problems = await runHint(hint, {
      '/': html('', { 'set-cookie': 'sid=1; Path=/' }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('1 first-party and 0 third-party');
    expect(problems[0].sourceCode).toBe(
      'Set-Cookie: sid; Domain=127.0.0.1; Path=/',
    );
    expect(problems[0].codeLanguage).toBe('http');
  });

  it('counts document.cookie as first party', async () => {
    setEvaluate(() => 'a=1; b=2');
    const problems = await runHint(hint, { '/': html('') });
    expect(problems[0].message).toContain('2 first-party and 0 third-party');
    expect(problems[0].sourceCode).toBe('Cookie: a\nCookie: b');
  });

  it('reports third-party cookies and their domains', async () => {
    const problems = await runHint(hint, {
      '/': (req) =>
        html(
          `<img src="http://localhost:${req.headers.host?.split(':')[1]}/p.png">`,
        ),
      '/p.png': { headers: { 'set-cookie': 't=1' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('0 first-party and 1 third-party');
    expect(problems[0].message).toContain('(1): localhost');
  });

  it('lists each cookie with its attributes', async () => {
    const problems = await runHint(hint, {
      '/': html('', {
        'set-cookie': 'sid=1; Max-Age=3600; Secure; HttpOnly; SameSite=Strict',
      }),
    });
    expect(problems[0].message).toContain(
      'First-party cookies: 127.0.0.1 sid (expires ',
    );
    expect(problems[0].message).toContain('Secure, HttpOnly, SameSite=Strict');
    expect(problems[0].sourceCode).toMatch(
      /^Set-Cookie: sid; Domain=127\.0\.0\.1; Path=\/; Expires=.+; Secure; HttpOnly; SameSite=Strict$/,
    );
    expect(problems[0].sourceCode).not.toContain('sid=');
  });

  it('does not count a cookie the server deletes', async () => {
    expect(
      await runHint(hint, {
        '/': html('', { 'set-cookie': 'sid=; Max-Age=0' }),
      }),
    ).toEqual([]);
  });
});
