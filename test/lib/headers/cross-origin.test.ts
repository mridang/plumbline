import { describe, expect, it } from '@jest/globals';
import { crossOriginFindings } from '../../../src/lib/headers/cross-origin.js';

const obs = (p: 'coop' | 'coep' | 'corp', v: string[], m: string[] = []) =>
  crossOriginFindings(p, v, m, 'observatory');

describe('crossOriginFindings (observatory)', () => {
  it.each([
    ['coop', 'same-origin'],
    ['coop', 'same-origin-allow-popups'],
    ['coop', 'noopener-allow-popups'],
    ['coep', 'require-corp'],
    ['coep', 'credentialless'],
    ['corp', 'same-origin'],
    ['corp', 'same-site'],
  ] as const)('passes %s %s', (policy, value) => {
    expect(obs(policy, [value])).toEqual([]);
  });

  it('accepts parameters on COOP and COEP', () => {
    expect(obs('coop', ['same-origin; report-to="x"'])).toEqual([]);
  });

  it.each(['coop', 'coep', 'corp'] as const)(
    'hints when %s is missing',
    (policy) => {
      const [f] = obs(policy, []);
      expect(f?.severity).toBe('hint');
      expect(f?.message).toContain('not implemented');
    },
  );

  it.each([
    ['coop', 'unsafe-none'],
    ['coep', 'unsafe-none'],
    ['corp', 'cross-origin'],
  ] as const)('hints on the default %s %s', (policy, value) => {
    const [f] = obs(policy, [value]);
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('no protection');
  });

  it.each([
    ['coop', 'bogus'],
    ['coop', '"same-origin"'],
    ['coep', 'Require-Corp'],
    ['corp', 'bogus'],
  ] as const)('errors on invalid %s %s', (policy, value) => {
    expect(obs(policy, [value])[0]?.severity).toBe('error');
  });

  it('errors when a COOP or COEP header is sent twice', () => {
    expect(obs('coep', ['require-corp', 'require-corp'])[0]?.message).toContain(
      'more than once',
    );
  });

  it('lets a CORP header win over a meta, and uses the meta otherwise', () => {
    expect(obs('corp', ['same-origin'], ['bogus'])).toEqual([]);
    expect(obs('corp', [], ['same-site'])).toEqual([]);
    expect(obs('corp', [], ['bogus'])[0]?.severity).toBe('error');
  });

  it('treats an empty value as missing', () => {
    expect(obs('corp', [''])[0]?.severity).toBe('hint');
  });
});

describe('crossOriginFindings (owasp)', () => {
  const owasp = (p: 'coop' | 'coep' | 'corp', v: string[]) =>
    crossOriginFindings(p, v, [], 'owasp');

  it('requires the strict value', () => {
    expect(owasp('coop', ['same-origin'])).toEqual([]);
    expect(owasp('coep', ['require-corp'])).toEqual([]);
    expect(owasp('corp', ['same-origin'])).toEqual([]);
  });

  it('rejects other values and missing headers', () => {
    expect(owasp('coep', ['credentialless'])[0]?.message).toContain(
      "'require-corp'",
    );
    expect(owasp('corp', ['same-site'])[0]?.message).toContain("'same-origin'");
    expect(owasp('coop', [])[0]?.message).toContain('not specified');
    expect(owasp('coop', ['same-origin', 'same-origin'])[0]?.severity).toBe(
      'error',
    );
  });
});
