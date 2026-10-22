import { describe, expect, it } from '@jest/globals';
import {
  deprecatedHeaderFindings,
  exactHeaderFindings,
} from '../../../src/lib/headers/exact-header.js';

describe('exactHeaderFindings', () => {
  it('passes an allowed value regardless of case and spaces', () => {
    expect(exactHeaderFindings('X', ' NONE ', ['none'])).toEqual([]);
  });

  it('errors on a missing header', () => {
    expect(exactHeaderFindings('X', null, ['none'])[0]?.message).toContain(
      'not specified',
    );
  });

  it('errors on another value and lists the allowed ones', () => {
    expect(exactHeaderFindings('X', 'all', ['a', 'b'])[0]?.message).toContain(
      "'a' or 'b'",
    );
  });
});

describe('deprecatedHeaderFindings', () => {
  it('is silent without the header', () => {
    expect(deprecatedHeaderFindings('X', null, 'why')).toEqual([]);
  });

  it('errors when the header is present', () => {
    const [f] = deprecatedHeaderFindings('X', 'v', 'because');
    expect(f?.severity).toBe('error');
    expect(f?.message).toContain('because');
  });
});
