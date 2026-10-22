import { describe, expect, it } from '@jest/globals';
import {
  analyzeCors,
  corsFindings,
  PROBE_ORIGIN,
} from '../../../src/lib/headers/cors.js';

const input = (
  allowOrigin: string | null,
  allowCredentials: string | null = null,
) => ({
  allowOrigin,
  allowCredentials,
  origin: PROBE_ORIGIN,
});

describe('analyzeCors', () => {
  it('is not implemented without the header', () => {
    expect(analyzeCors(input(null))).toBe('not-implemented');
  });

  it('is public for *', () => {
    expect(analyzeCors(input('*'))).toBe('public');
    expect(analyzeCors(input('*', 'true'))).toBe('public');
  });

  it('is universal when the origin is reflected with credentials', () => {
    expect(analyzeCors(input(PROBE_ORIGIN, ' True '))).toBe('universal');
  });

  it('is restricted otherwise', () => {
    expect(analyzeCors(input('https://a.example', 'true'))).toBe('restricted');
    expect(analyzeCors(input(PROBE_ORIGIN))).toBe('restricted');
    expect(analyzeCors(input(PROBE_ORIGIN, 'false'))).toBe('restricted');
  });
});

describe('corsFindings', () => {
  it('errors on universal access', () => {
    const [f] = corsFindings(input(PROBE_ORIGIN, 'true'));
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('CSRF');
  });

  it('hints on public access', () => {
    expect(corsFindings(input('*'))[0]?.severity).toBe('hint');
  });

  it('is silent otherwise', () => {
    expect(corsFindings(input(null))).toEqual([]);
    expect(corsFindings(input('https://a.example'))).toEqual([]);
  });
});
