import { describe, expect, it } from '@jest/globals';
import { setLoginFindings } from '../../../src/lib/headersx/fedcm.js';

describe('setLoginFindings', () => {
  it('is silent when absent', () => {
    expect(setLoginFindings(null)).toEqual([]);
  });

  it('accepts logged-in and logged-out, case-insensitively', () => {
    expect(setLoginFindings('logged-in')).toEqual([]);
    expect(setLoginFindings('LOGGED-OUT')).toEqual([]);
  });

  it('warns on any other value', () => {
    const [f] = setLoginFindings('maybe');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('logged-in');
  });
});
