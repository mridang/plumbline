import { describe, expect, it } from '@jest/globals';
import { UsageError } from '../src/args.js';
import { normalizeTarget } from '../src/target.js';

describe('normalizeTarget', () => {
  it('scans a bare domain over HTTPS', () => {
    expect(normalizeTarget('example.com')).toBe('https://example.com/');
  });

  it('keeps the path of a bare domain', () => {
    expect(normalizeTarget('example.com/blog')).toBe(
      'https://example.com/blog',
    );
  });

  it('keeps an explicit http URL', () => {
    expect(normalizeTarget('http://127.0.0.1:8080/')).toBe(
      'http://127.0.0.1:8080/',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTarget('  example.com ')).toBe('https://example.com/');
  });

  it('refuses an empty target', () => {
    expect(() => normalizeTarget('  ')).toThrow(UsageError);
  });

  it('refuses another scheme', () => {
    expect(() => normalizeTarget('ftp://example.com/')).toThrow(
      'only http and https URLs can be scanned',
    );
  });

  it('refuses something that is not a host', () => {
    expect(() => normalizeTarget('exa mple.com')).toThrow(
      '"exa mple.com" is not a URL or a domain',
    );
  });
});
