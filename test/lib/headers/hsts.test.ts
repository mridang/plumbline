import { describe, expect, it } from '@jest/globals';
import {
  baseDomainHstsFindings,
  hstsFindings,
  hstsProtects,
  parseHsts,
} from '../../../src/lib/headers/hsts.js';

describe('parseHsts', () => {
  it('reads all directives', () => {
    expect(parseHsts('max-age=100; includeSubDomains; preload')).toMatchObject({
      valid: true,
      maxAge: 100,
      includeSubDomains: true,
      preload: true,
    });
  });

  it('accepts a quoted max-age and collects unknown directives', () => {
    expect(parseHsts('max-age="5"; foo')).toMatchObject({
      maxAge: 5,
      unknown: ['foo'],
    });
  });

  it.each([
    ['includeSubDomains', 'max-age missing'],
    ['max-age=abc', 'not a number'],
    ['max-age=', 'not a number'],
    ['max-age=1; max-age=2', 'duplicate directive max-age'],
    ['max-age=1; preload; PRELOAD', 'duplicate directive preload'],
    ['max-age=1, max-age=2', 'multiple times'],
  ])('rejects %s', (header, problem) => {
    const parsed = parseHsts(header);
    expect(parsed.valid).toBe(false);
    expect(parsed.problem).toContain(problem);
  });
});

describe('hstsProtects', () => {
  it('needs https and six months', () => {
    expect(hstsProtects('max-age=15552000', true)).toBe(true);
    expect(hstsProtects('max-age=15551999', true)).toBe(false);
    expect(hstsProtects('max-age=15552000', false)).toBe(false);
    expect(hstsProtects(null, true)).toBe(false);
    expect(hstsProtects('nonsense', true)).toBe(false);
  });
});

describe('hstsFindings (observatory)', () => {
  const run = (header: string | null, secure = true) =>
    hstsFindings({ header, secure, profile: 'observatory' });

  it('errors on a site without https', () => {
    const f = run(null, false);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain('not available over HTTPS');
  });

  it('also warns that the header is ignored over http', () => {
    const f = run('max-age=31536000', false);
    expect(f.map((x) => x.severity)).toEqual(['error', 'warning']);
  });

  it('errors on a missing header', () => {
    expect(run(null)[0]?.message).toContain('not implemented');
  });

  it('errors on an invalid header', () => {
    expect(run('max-age=x')[0]?.message).toContain('cannot be recognized');
  });

  it('errors below six months', () => {
    expect(run('max-age=100')[0]?.message).toContain('less than six months');
  });

  it('warns about unknown directives', () => {
    const f = run('max-age=31536000; includeSubDomains; preload; foo');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('warning');
    expect(f[0]?.message).toContain("'foo'");
  });

  it('suggests preloading', () => {
    const f = run('max-age=15552000');
    expect(f[0]?.severity).toBe('hint');
    expect(f[0]?.message).toContain('preloading');
  });

  it('is silent for a preload ready header', () => {
    expect(run('max-age=31536000; includeSubDomains; preload')).toEqual([]);
  });
});

describe('hstsFindings (owasp)', () => {
  const run = (header: string | null) =>
    hstsFindings({ header, secure: false, profile: 'owasp' });

  it('requires the header', () => {
    expect(run(null)[0]?.message).toContain('not specified');
  });

  it.each([
    'max-age=63072000; includeSubDomains',
    'max-age=63072000; includeSubDomains; preload',
    'max-age=63072000;includeSubDomains;preload',
    'MAX-AGE=63072000; INCLUDESUBDOMAINS',
  ])('accepts %s', (header) => {
    expect(run(header)).toEqual([]);
  });

  it.each([
    'max-age=31536000; includeSubDomains',
    'max-age=63072000',
    'max-age=63072000; preload',
  ])('rejects %s', (header) => {
    expect(run(header)[0]?.message).toContain('63072000');
  });
});

describe('baseDomainHstsFindings', () => {
  const good = 'max-age=31536000; includeSubDomains';

  it('does nothing for bare hosts, the base domain itself or a failed fetch', () => {
    expect(baseDomainHstsFindings('127.0.0.1', null)).toEqual([]);
    expect(baseDomainHstsFindings('example.com', null)).toEqual([]);
    expect(baseDomainHstsFindings('www.example.com', undefined)).toEqual([]);
  });

  it('warns when the base domain sends no header', () => {
    const [f] = baseDomainHstsFindings('www.example.com', null);
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('example.com');
  });

  it('warns on a weak or invalid base header', () => {
    expect(
      baseDomainHstsFindings('www.example.com', 'max-age=10')[0]?.severity,
    ).toBe('warning');
    expect(
      baseDomainHstsFindings('www.example.com', 'bogus')[0]?.severity,
    ).toBe('warning');
  });

  it('hints when includeSubDomains is missing', () => {
    expect(
      baseDomainHstsFindings('www.example.com', 'max-age=31536000')[0]
        ?.severity,
    ).toBe('hint');
  });

  it('is silent when the base domain covers subdomains', () => {
    expect(baseDomainHstsFindings('www.example.com', good)).toEqual([]);
  });
});
