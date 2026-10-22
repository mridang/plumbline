import { describe, expect, it } from '@jest/globals';
import {
  acceptChFindings,
  altSvcFindings,
  criticalChFindings,
  retryAfterFindings,
  timingAllowOriginFindings,
} from '../../../src/lib/headers/client-hints.js';

describe('acceptChFindings', () => {
  it('is silent when absent', () => {
    expect(acceptChFindings(null)).toEqual([]);
  });

  it('notes a valid token list as fingerprinting surface', () => {
    const [f] = acceptChFindings('Sec-CH-UA, Sec-CH-UA-Mobile');
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('fingerprinting');
  });

  it('warns on a malformed token', () => {
    expect(acceptChFindings('bad token with spaces')[0]?.severity).toBe(
      'warning',
    );
  });
});

describe('criticalChFindings', () => {
  it('is silent when absent', () => {
    expect(criticalChFindings(null, 'Sec-CH-UA')).toEqual([]);
  });

  it('accepts a subset of Accept-CH', () => {
    expect(
      criticalChFindings('Sec-CH-UA', 'Sec-CH-UA, Sec-CH-UA-Mobile'),
    ).toEqual([]);
  });

  it('errors on a hint missing from Accept-CH', () => {
    const [f] = criticalChFindings('Sec-CH-UA-Platform', 'Sec-CH-UA');
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('Sec-CH-UA-Platform');
  });
});

describe('timingAllowOriginFindings', () => {
  it('is silent for a valid origin list', () => {
    expect(timingAllowOriginFindings('https://a.test, https://b.test')).toEqual(
      [],
    );
  });

  it('warns on a wildcard', () => {
    expect(timingAllowOriginFindings('*')[0]?.message).toContain(
      'every origin',
    );
  });

  it('warns on a malformed member', () => {
    expect(timingAllowOriginFindings('https://a.test/path')[0]?.severity).toBe(
      'warning',
    );
  });
});

describe('altSvcFindings', () => {
  it('is silent when absent or clear', () => {
    expect(altSvcFindings(null)).toEqual([]);
    expect(altSvcFindings('clear')).toEqual([]);
  });

  it('notes advertised protocols', () => {
    const [f] = altSvcFindings('h3=":443"; ma=2592000, h2=":443"');
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('h3');
  });

  it('warns on a malformed value', () => {
    expect(altSvcFindings('garbage')[0]?.severity).toBe('warning');
  });
});

describe('retryAfterFindings', () => {
  it('is not applicable on a 200', () => {
    expect(retryAfterFindings('120', 200)).toEqual([]);
  });

  it('accepts delta-seconds on a 503', () => {
    expect(retryAfterFindings('120', 503)).toEqual([]);
  });

  it('accepts an HTTP-date on a 429', () => {
    expect(retryAfterFindings('Wed, 21 Oct 2015 07:28:00 GMT', 429)).toEqual(
      [],
    );
  });

  it('warns on a malformed value on a 503', () => {
    expect(retryAfterFindings('soon', 503)[0]?.severity).toBe('warning');
  });
});
