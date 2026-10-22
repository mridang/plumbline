import { describe, expect, it } from '@jest/globals';
import {
  effectiveReferrerPolicy,
  lastKnownPolicy,
  referrerPolicyFindings,
} from '../../../src/lib/headers/referrer-policy.js';

const none = { metaName: [], metaHttpEquiv: [], header: [] };

describe('effectiveReferrerPolicy', () => {
  it('is null when nothing is declared', () => {
    expect(effectiveReferrerPolicy(none)).toBeNull();
  });

  it('prefers meta name over http-equiv over header', () => {
    const all = { metaName: ['a', 'b'], metaHttpEquiv: ['c'], header: ['d'] };
    expect(effectiveReferrerPolicy(all)).toBe('b');
    expect(effectiveReferrerPolicy({ ...all, metaName: [] })).toBe('c');
    expect(
      effectiveReferrerPolicy({ ...all, metaName: [], metaHttpEquiv: [] }),
    ).toBe('d');
  });

  it('joins a repeated header', () => {
    expect(effectiveReferrerPolicy({ ...none, header: ['x', 'y'] })).toBe(
      'x, y',
    );
  });
});

describe('lastKnownPolicy', () => {
  it('takes the last recognised token', () => {
    expect(lastKnownPolicy('unsafe-url, bogus, Same-Origin')).toBe(
      'same-origin',
    );
    expect(lastKnownPolicy('same-origin, bogus')).toBe('same-origin');
  });

  it('is null without a recognised token', () => {
    expect(lastKnownPolicy('bogus')).toBeNull();
  });
});

describe('referrerPolicyFindings (observatory)', () => {
  it.each([
    'no-referrer',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
  ])('passes %s', (value) => {
    expect(referrerPolicyFindings(value, 'observatory')).toEqual([]);
  });

  it.each([
    'origin',
    'origin-when-cross-origin',
    'unsafe-url',
    'no-referrer-when-downgrade',
  ])('errors on unsafe %s', (value) => {
    const [f] = referrerPolicyFindings(value, 'observatory');
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('set unsafely');
  });

  it('errors on an unrecognised value', () => {
    expect(
      referrerPolicyFindings('bogus', 'observatory')[0]?.message,
    ).toContain('cannot be recognized');
  });

  it('warns when nothing is declared', () => {
    const [f] = referrerPolicyFindings(null, 'observatory');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('not implemented');
  });

  it('uses the last recognised value of a list', () => {
    expect(
      referrerPolicyFindings('unsafe-url, same-origin', 'observatory'),
    ).toEqual([]);
  });
});

describe('referrerPolicyFindings (owasp)', () => {
  it('requires no-referrer', () => {
    expect(referrerPolicyFindings('no-referrer', 'owasp')).toEqual([]);
    expect(referrerPolicyFindings('x, No-Referrer', 'owasp')).toEqual([]);
    expect(
      referrerPolicyFindings('same-origin', 'owasp')[0]?.message,
    ).toContain("'no-referrer'");
  });

  it('errors when missing', () => {
    expect(referrerPolicyFindings(null, 'owasp')[0]?.message).toContain(
      'not specified',
    );
  });
});
