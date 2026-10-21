import { describe, expect, it } from '@jest/globals';
import {
  cookieLine,
  cookiesFromDocument,
  cookiesFromHeaders,
  describeCookie,
  parseSetCookie,
  splitSetCookie,
  summarizeCookies,
} from '../../../src/lib/privacy/cookies.js';

describe('splitSetCookie', () => {
  it('splits folded cookies but keeps Expires dates intact', () => {
    expect(
      splitSetCookie('a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT, b=2; Secure'),
    ).toEqual(['a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT', 'b=2; Secure']);
  });
});

describe('parseSetCookie', () => {
  it('reads attributes', () => {
    expect(
      parseSetCookie(
        'sid=1; Domain=.Example.com; Secure; HttpOnly; SameSite=Lax',
        'www.example.com',
      ),
    ).toEqual({
      name: 'sid',
      domain: 'example.com',
      path: '/',
      lifetime: 'session',
      expires: null,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      fromScript: false,
    });
  });
  it('defaults the domain to the setting host', () => {
    expect(parseSetCookie('a=1', 'Host.test')?.domain).toBe('host.test');
  });
  const now = Date.parse('2026-01-01T00:00:00Z');
  it('reads Max-Age and Expires, Max-Age first', () => {
    expect(
      parseSetCookie('a=1; Max-Age=3600; Path=/x', 'a.test', now),
    ).toMatchObject({
      lifetime: 'persistent',
      expires: '2026-01-01T01:00:00.000Z',
      path: '/x',
    });
    expect(
      parseSetCookie(
        'a=1; Expires=Fri, 01 Jan 2027 00:00:00 GMT',
        'a.test',
        now,
      ),
    ).toMatchObject({
      lifetime: 'persistent',
      expires: '2027-01-01T00:00:00.000Z',
    });
    expect(
      parseSetCookie(
        'a=1; Expires=Fri, 01 Jan 2020 00:00:00 GMT; Max-Age=60',
        'a.test',
        now,
      ),
    ).toMatchObject({ lifetime: 'persistent' });
  });
  it('drops cookies that are already expired', () => {
    expect(parseSetCookie('a=; Max-Age=0', 'a.test', now)).toBeNull();
    expect(parseSetCookie('a=; Max-Age=-1', 'a.test', now)).toBeNull();
    expect(
      parseSetCookie(
        'a=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'a.test',
        now,
      ),
    ).toBeNull();
  });
  it('drops a Domain that does not cover the setting host', () => {
    expect(parseSetCookie('a=1; Domain=other.test', 'a.test')).toBeNull();
    expect(parseSetCookie('a=1; Domain=test', 'a.test')).not.toBeNull();
  });
  it('rejects a value without a name', () => {
    expect(parseSetCookie('garbage', 'a.test')).toBeNull();
    expect(parseSetCookie('=1', 'a.test')).toBeNull();
  });
});

describe('cookiesFromHeaders', () => {
  it('handles undefined, strings and lists', () => {
    expect(cookiesFromHeaders(undefined, 'a.test')).toEqual([]);
    expect(cookiesFromHeaders('a=1', 'a.test')).toHaveLength(1);
    expect(cookiesFromHeaders(['a=1', 'b=2'], 'a.test')).toHaveLength(2);
  });
});

describe('cookiesFromDocument', () => {
  it('reads names from document.cookie', () => {
    const cookies = cookiesFromDocument('a=1; b=2; junk', 'a.test');
    expect(cookies.map((c) => c.name)).toEqual(['a', 'b']);
    expect(cookies[0].fromScript).toBe(true);
    expect(cookiesFromDocument('', 'a.test')).toEqual([]);
  });
});

describe('summarizeCookies', () => {
  it('splits first and third party and lists unique third-party domains', () => {
    const cookies = [
      ...cookiesFromHeaders(['a=1', 'b=2'], 'www.example.com'),
      ...cookiesFromHeaders(['t=1', 'u=2'], 'tracker.test'),
    ];
    const summary = summarizeCookies(cookies, 'example.com');
    expect(summary.firstParty).toHaveLength(2);
    expect(summary.thirdParty).toHaveLength(2);
    expect(summary.thirdPartyDomains).toEqual(['tracker.test']);
  });
  it('counts a Domain cookie and its document.cookie copy once', () => {
    const cookies = [
      ...cookiesFromHeaders('a=1; Domain=example.com', 'www.example.com'),
      ...cookiesFromDocument('a=1', 'www.example.com'),
    ];
    expect(
      summarizeCookies(cookies, 'www.example.com').firstParty,
    ).toHaveLength(1);
  });
  it('keeps same-named cookies on different paths', () => {
    const cookies = [
      ...cookiesFromHeaders(['a=1; Path=/x', 'a=2; Path=/y'], 'example.com'),
    ];
    expect(summarizeCookies(cookies, 'example.com').firstParty).toHaveLength(2);
  });
  it('counts a cookie seen twice once', () => {
    const cookies = [
      ...cookiesFromHeaders('a=1', 'example.com'),
      ...cookiesFromDocument('a=1', 'example.com'),
    ];
    expect(summarizeCookies(cookies, 'example.com').firstParty).toHaveLength(1);
  });
});

describe('describeCookie', () => {
  it('lists the fields Webbkoll tabulates and no value', () => {
    const [cookie] = cookiesFromHeaders(
      'averyveryverylongcookiename=secret; Max-Age=60; Secure; HttpOnly; SameSite=Lax',
      'example.com',
    );
    const text = describeCookie(cookie);
    expect(text).toContain('example.com averyveryverylongcoo... (expires ');
    expect(text).toContain('Secure, HttpOnly, SameSite=Lax');
    expect(text).not.toContain('secret');
  });
  it('says session, not Secure, not HttpOnly and no SameSite', () => {
    const [cookie] = cookiesFromHeaders('a=1', 'example.com');
    expect(describeCookie(cookie)).toBe(
      'example.com a (session, not Secure, not HttpOnly, no SameSite)',
    );
  });
});

describe('cookieLine', () => {
  it('writes the attributes and never the value', () => {
    const [cookie] = cookiesFromHeaders(
      'sid=secret; Path=/a; Secure; SameSite=Lax',
      'example.com',
    );
    expect(cookieLine(cookie)).toBe(
      'Set-Cookie: sid; Domain=example.com; Path=/a; Secure; SameSite=Lax',
    );
  });

  it('writes a script cookie with only its name', () => {
    const [cookie] = cookiesFromDocument('a=1', 'example.com');
    expect(cookieLine(cookie)).toBe('Cookie: a');
  });
});
