import { describe, expect, it } from '@jest/globals';

import { readTarget } from '@/domain/scan/target';

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

describe('readTarget', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  Example.COM  ', 'https://example.com/'],
    ['example.com/blog', 'https://example.com/blog'],
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/#top', 'https://example.com/'],
  ])('reads %s as %s', (input, expected) => {
    expect(urlOf(input)).toBe(expected);
  });

  it.each([
    ['', 'Enter a domain or a URL to scan.'],
    ['   ', 'Enter a domain or a URL to scan.'],
    [`${'a'.repeat(2050)}.com`, 'That address is too long.'],
    ['https://exa mple.com', 'That is not a domain or a URL.'],
    ['ftp://example.com', 'Only http and https addresses can be scanned.'],
    ['https://user:pw@example.com', 'Leave the user name and password out.'],
    ['10.0.0.1', 'Enter a domain name, not an IP address.'],
    ['http://[::1]/', 'Enter a domain name, not an IP address.'],
    ['localhost', 'Only public domains can be scanned.'],
    ['intranet', 'Only public domains can be scanned.'],
    ['printer.local', 'Only public domains can be scanned.'],
    ['app.localhost', 'Only public domains can be scanned.'],
    ['db.internal', 'Only public domains can be scanned.'],
    ['nas.home.arpa', 'Only public domains can be scanned.'],
  ])('refuses %j', (input, reason) => {
    expect(reasonOf(input)).toBe(reason);
  });
});
