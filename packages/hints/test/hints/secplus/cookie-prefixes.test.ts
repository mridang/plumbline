import { describe, expect, it } from '@jest/globals';
import { runHint } from '../../helpers/run-hint.js';
import cookiePrefixes from '../../../src/hints/secplus/cookie-prefixes.js';

/** Serves the page with the given Set-Cookie header. */
function withCookie(setCookie: string) {
  return {
    '/': {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': setCookie,
      },
    },
  };
}

describe('the cookie-prefixes hint', () => {
  it('flags a __Host- cookie without Secure', async () => {
    const problems = await runHint(
      cookiePrefixes,
      withCookie('__Host-id=abc; Path=/'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('__Host-');
  });

  it('flags a __Secure- cookie without Secure', async () => {
    const problems = await runHint(
      cookiePrefixes,
      withCookie('__Secure-id=abc; Path=/'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('__Secure-');
  });

  it('accepts a correct __Host- cookie', async () => {
    const problems = await runHint(
      cookiePrefixes,
      withCookie('__Host-id=abc; Secure; Path=/'),
    );
    expect(problems).toHaveLength(0);
  });

  it('ignores a cookie with no special prefix', async () => {
    const problems = await runHint(cookiePrefixes, withCookie('session=abc'));
    expect(problems).toHaveLength(0);
  });

  it('passes a page with no cookies', async () => {
    const problems = await runHint(cookiePrefixes);
    expect(problems).toHaveLength(0);
  });
});
