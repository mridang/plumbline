import { describe, expect, it } from '@jest/globals';

import { canonicalUrl, readTarget } from '@/domain/scan/target';

/** The URL a valid input becomes. */
const urlOf = (input: string): string | undefined => {
  const target = readTarget(input);
  return target.ok ? target.url.href : undefined;
};

/** Why an input is refused. */
const reasonOf = (input: string): string | undefined => {
  const target = readTarget(input);
  return target.ok ? undefined : target.reason;
};

describe('canonicalUrl', () => {
  it('gives the same address for the same page written two ways', () => {
    expect(
      canonicalUrl(new URL('https://EXAMPLE.com.:443//a?z=1&utm_x=2&a=3#f'))
        .href,
    ).toBe(canonicalUrl(new URL('https://example.com/a?a=3&z=1')).href);
  });

  it('keeps a value it cannot decode as it was written', () => {
    expect(canonicalUrl(new URL('https://example.com/?%E0=1')).href).toBe(
      'https://example.com/?%E0=1',
    );
  });
});

describe('readTarget', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  Example.COM  ', 'https://example.com/'],
    ['example.com/blog', 'https://example.com/blog'],
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/#top', 'https://example.com/'],
    ['example.com.', 'https://example.com/'],
    ['https://example.com:443/', 'https://example.com/'],
    ['example.com//a///b', 'https://example.com/a/b'],
    ['example.com/a/../b', 'https://example.com/b'],
    [
      'example.com/?utm_source=x&b=2&gclid=y&a=1',
      'https://example.com/?a=1&b=2',
    ],
    ['example.com/?UTM_Medium=x&fbclid=1', 'https://example.com/'],
    ['example.com/?q=a+b&p=%20', 'https://example.com/?p=%20&q=a+b'],
    ['example.com/?b=2&b=1', 'https://example.com/?b=2&b=1'],
    ['example.com/?', 'https://example.com/'],
  ])('reads %s as %s', (input, expected) => {
    expect(urlOf(input)).toBe(expected);
  });

  it.each([
    ['', 'Enter a domain or a URL to scan.'],
    [' '.repeat(3), 'Enter a domain or a URL to scan.'],
    [`${'a'.repeat(2050)}.com`, 'That address is too long.'],
    ['https://exa mple.com', 'That is not a domain or a URL.'],
    ['ftp://example.com', 'Only http and https addresses can be scanned.'],
    ['https://user:pw@example.com', 'Leave the user name and password out.'],
    ['10.0.0.1', 'Enter a domain name, not an IP address.'],
    ['http://[::1]/', 'Enter a domain name, not an IP address.'],
    ['localhost', 'Only public domains can be scanned.'],
    ['localhost.', 'Only public domains can be scanned.'],
    ['intranet', 'Only public domains can be scanned.'],
    ['printer.local', 'Only public domains can be scanned.'],
    ['app.localhost', 'Only public domains can be scanned.'],
    ['db.internal', 'Only public domains can be scanned.'],
    ['nas.home.arpa', 'Only public domains can be scanned.'],
  ])('refuses %j', (input, reason) => {
    expect(reasonOf(input)).toBe(reason);
  });
});
