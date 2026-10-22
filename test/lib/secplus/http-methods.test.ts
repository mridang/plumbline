import { describe, expect, it } from '@jest/globals';
import {
  httpMethodsFindings,
  parseAllowedMethods,
} from '../../../src/lib/secplus/http-methods.js';

describe('parseAllowedMethods', () => {
  it('splits and upper-cases a method list', () => {
    expect(parseAllowedMethods('get, post ,Options')).toEqual([
      'GET',
      'POST',
      'OPTIONS',
    ]);
  });

  it('returns nothing for a null or empty header', () => {
    expect(parseAllowedMethods(null)).toEqual([]);
    expect(parseAllowedMethods('')).toEqual([]);
  });
});

describe('httpMethodsFindings', () => {
  it('returns nothing for a safe method set', () => {
    expect(httpMethodsFindings(['GET', 'POST', 'HEAD', 'OPTIONS'])).toEqual([]);
  });

  it('errors when TRACE is enabled', () => {
    const [found] = httpMethodsFindings(['GET', 'TRACE']);
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain('TRACE');
  });

  it('errors when TRACK is enabled', () => {
    const [found] = httpMethodsFindings(['GET', 'TRACK']);
    expect(found?.severity).toBe('error');
  });

  it('warns when write methods are allowed', () => {
    const findings = httpMethodsFindings(['GET', 'PUT', 'DELETE']);
    const warning = findings.find((f) => f.severity === 'warning');
    expect(warning?.message).toContain('PUT');
    expect(warning?.message).toContain('DELETE');
  });

  it('reports both TRACE and write methods', () => {
    const findings = httpMethodsFindings(['GET', 'TRACE', 'PUT']);
    expect(findings.some((f) => f.severity === 'error')).toBe(true);
    expect(findings.some((f) => f.severity === 'warning')).toBe(true);
  });

  it('is case-insensitive', () => {
    const [found] = httpMethodsFindings(['trace']);
    expect(found?.severity).toBe('error');
  });
});
