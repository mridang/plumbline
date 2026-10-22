import { describe, expect, it } from '@jest/globals';
import {
  corsAllowCredentialsFindings,
  corsAllowHeadersFindings,
  corsAllowMethodsFindings,
  corsExposeHeadersFindings,
  corsMaxAgeFindings,
} from '../../../src/lib/headers/cors-extra.js';

describe('corsAllowCredentialsFindings', () => {
  it('is silent when absent', () => {
    expect(corsAllowCredentialsFindings(null, '*')).toEqual([]);
  });

  it('errors when true is combined with Allow-Origin *', () => {
    const [f] = corsAllowCredentialsFindings('true', '*');
    expect(f?.severity).toBe('error');
  });

  it('warns when true with a specific origin', () => {
    expect(
      corsAllowCredentialsFindings('true', 'https://x.test')[0]?.severity,
    ).toBe('warning');
  });

  it('warns on a value other than true', () => {
    expect(corsAllowCredentialsFindings('false', null)[0]?.message).toContain(
      'true',
    );
  });
});

describe('corsAllowMethodsFindings', () => {
  it('is silent for a known method list', () => {
    expect(corsAllowMethodsFindings('GET, POST')).toEqual([]);
  });

  it('warns on a wildcard', () => {
    expect(corsAllowMethodsFindings('*')[0]?.severity).toBe('warning');
  });

  it('warns on an unknown method', () => {
    expect(corsAllowMethodsFindings('GET, FOOBAR')[0]?.message).toContain(
      'FOOBAR',
    );
  });
});

describe('corsAllowHeadersFindings', () => {
  it('is silent for a named list', () => {
    expect(corsAllowHeadersFindings('Content-Type, Authorization')).toEqual([]);
  });

  it('warns on a wildcard', () => {
    expect(corsAllowHeadersFindings('*')[0]?.severity).toBe('warning');
  });
});

describe('corsExposeHeadersFindings', () => {
  it('is silent for a benign list', () => {
    expect(corsExposeHeadersFindings('Content-Length')).toEqual([]);
  });

  it('warns on a wildcard', () => {
    expect(corsExposeHeadersFindings('*')[0]?.severity).toBe('warning');
  });

  it('warns when a sensitive header is exposed', () => {
    expect(corsExposeHeadersFindings('Set-Cookie')[0]?.message).toContain(
      'Set-Cookie',
    );
  });
});

describe('corsMaxAgeFindings', () => {
  it('is silent for a reasonable value', () => {
    expect(corsMaxAgeFindings('600')).toEqual([]);
  });

  it('warns on a non-integer', () => {
    expect(corsMaxAgeFindings('ten')[0]?.severity).toBe('warning');
  });

  it('notes an excessive cache', () => {
    expect(corsMaxAgeFindings('999999')[0]?.severity).toBe('hint');
  });
});
