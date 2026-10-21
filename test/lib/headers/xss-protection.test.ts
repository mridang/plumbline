import { describe, expect, it } from '@jest/globals';
import {
  parseXssProtection,
  xssProtectionFindings,
} from '../../../src/lib/headers/xss-protection.js';

describe('parseXssProtection', () => {
  it('reads enabled with mode=block', () => {
    expect(parseXssProtection('1; mode=block')).toEqual({
      valid: true,
      enabled: true,
      modeBlock: true,
    });
  });

  it('reads plain enabled and disabled', () => {
    expect(parseXssProtection('1')).toMatchObject({
      valid: true,
      enabled: true,
      modeBlock: false,
    });
    expect(parseXssProtection('0')).toMatchObject({
      valid: true,
      enabled: false,
    });
  });

  it('accepts a report directive', () => {
    expect(parseXssProtection('1; report=https://a.example/r').valid).toBe(
      true,
    );
  });

  it.each([
    '',
    'yes',
    '1; mode=other',
    '1; foo=bar',
    '1; mode=block; mode=block',
  ])('rejects %j', (value) => {
    expect(parseXssProtection(value).valid).toBe(false);
  });
});

describe('xssProtectionFindings', () => {
  it('is silent without the header', () => {
    expect(xssProtectionFindings(null, false)).toEqual([]);
  });

  it('errors on an invalid header', () => {
    expect(xssProtectionFindings('x', false)[0]?.message).toContain(
      'cannot be recognized',
    );
  });

  it('errors when enabled, naming the missing CSP', () => {
    const [f] = xssProtectionFindings('1; mode=block', false);
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('use a Content Security Policy instead');
  });

  it('says it is not needed when a CSP passes', () => {
    expect(xssProtectionFindings('1', true)[0]?.message).toContain(
      'not needed',
    );
  });

  it('only warns when explicitly disabled', () => {
    const [f] = xssProtectionFindings('0', true);
    expect(f?.severity).toBe('warning');
  });
});
