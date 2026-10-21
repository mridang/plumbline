import { describe, expect, it } from '@jest/globals';
import {
  analyzeCookies,
  cookieFindings,
  parseSetCookie,
} from '../../../src/lib/headers/cookies.js';

describe('parseSetCookie', () => {
  it('reads the flags', () => {
    expect(
      parseSetCookie('id=1; Path=/; Secure; HttpOnly; SameSite=Lax'),
    ).toEqual({
      name: 'id',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      sameSiteInvalid: false,
    });
  });

  it('marks an invalid or empty SameSite', () => {
    expect(parseSetCookie('a=1; SameSite=Sideways')?.sameSiteInvalid).toBe(
      true,
    );
    expect(parseSetCookie('a=1; SameSite')?.sameSiteInvalid).toBe(true);
    expect(parseSetCookie('a=1; SameSite=')?.sameSite).toBeUndefined();
  });

  it('rejects a cookie without a name', () => {
    expect(parseSetCookie('=1')).toBeNull();
    expect(parseSetCookie('junk')).toBeNull();
  });
});

describe('analyzeCookies', () => {
  const good = 'theme=dark; Secure; HttpOnly; SameSite=Lax';

  it('finds no cookies', () => {
    expect(analyzeCookies([], false)).toBe('cookies-not-found');
    expect(analyzeCookies(['heroku-session-affinity=x'], false)).toBe(
      'cookies-not-found',
    );
  });

  it('is best with Secure, HttpOnly sessions and SameSite', () => {
    expect(
      analyzeCookies(
        [good, 'sessionid=1; Secure; HttpOnly; SameSite=Strict'],
        false,
      ),
    ).toBe('cookies-secure-with-httponly-sessions-and-samesite');
  });

  it('is good but advises SameSite when one cookie lacks it', () => {
    expect(analyzeCookies([good, 'a=1; Secure'], false)).toBe(
      'cookies-secure-with-httponly-sessions',
    );
  });

  it('flags cookies without Secure, with and without HSTS', () => {
    expect(analyzeCookies(['a=1; SameSite=Lax'], false)).toBe(
      'cookies-without-secure-flag',
    );
    expect(analyzeCookies(['a=1; SameSite=Lax'], true)).toBe(
      'cookies-without-secure-flag-but-protected-by-hsts',
    );
  });

  it('flags session cookies without Secure, with and without HSTS', () => {
    expect(analyzeCookies(['sessionid=1; HttpOnly; SameSite=Lax'], false)).toBe(
      'cookies-session-without-secure-flag',
    );
    expect(analyzeCookies(['login=1; HttpOnly; SameSite=Lax'], true)).toBe(
      'cookies-session-without-secure-flag-but-protected-by-hsts',
    );
  });

  it('flags a session cookie without HttpOnly', () => {
    expect(analyzeCookies(['PHPSESSID=1; Secure; SameSite=Lax'], false)).toBe(
      'cookies-session-without-httponly-flag',
    );
  });

  it('flags an anti-CSRF cookie without SameSite', () => {
    expect(analyzeCookies(['csrftoken=1; Secure'], false)).toBe(
      'cookies-anticsrf-without-samesite-flag',
    );
  });

  it('flags an invalid SameSite and SameSite=None without Secure', () => {
    expect(analyzeCookies(['a=1; Secure; SameSite=Sideways'], false)).toBe(
      'cookies-samesite-flag-invalid',
    );
    expect(analyzeCookies(['a=1; SameSite=None'], true)).toBe(
      'cookies-samesite-flag-invalid',
    );
  });

  it('reports the worst problem over all cookies', () => {
    expect(
      analyzeCookies(
        ['a=1; SameSite=Lax', 'sessionid=1; Secure; SameSite=Lax'],
        false,
      ),
    ).toBe('cookies-session-without-httponly-flag');
    expect(
      analyzeCookies(
        ['sessionid=1; Secure; SameSite=Lax', 'b=1; SameSite=Lax'],
        false,
      ),
    ).toBe('cookies-session-without-httponly-flag');
  });
});

describe('cookieFindings', () => {
  it('is silent without cookies or with perfect ones', () => {
    expect(cookieFindings([], false)).toEqual([]);
    expect(
      cookieFindings(['a=1; Secure; HttpOnly; SameSite=Lax'], false),
    ).toEqual([]);
  });

  it('hints to use SameSite', () => {
    const [f] = cookieFindings(['a=1; Secure; HttpOnly'], false);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('SameSite');
  });

  it('warns for HSTS protected cookies', () => {
    expect(cookieFindings(['a=1; SameSite=Lax'], true)[0]?.severity).toBe(
      'warning',
    );
    expect(
      cookieFindings(['sessionid=1; HttpOnly; SameSite=Lax'], true)[0]
        ?.severity,
    ).toBe('warning');
  });

  it.each([
    ['a=1; SameSite=Lax', 'Secure flag or set over HTTP'],
    ['a=1; Secure; SameSite=Bogus', 'something other than Strict or Lax'],
    ['csrf=1; Secure', 'Anti-CSRF'],
    ['sessionid=1; Secure; SameSite=Lax', 'HttpOnly'],
    [
      'sessionid=1; HttpOnly; SameSite=Lax',
      'Session cookie set without using the Secure flag',
    ],
  ])('errors for %s', (cookie, text) => {
    const [f] = cookieFindings([cookie], false);
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain(text);
  });
});
