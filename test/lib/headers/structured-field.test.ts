import { describe, expect, it } from '@jest/globals';
import { parseStructuredToken } from '../../../src/lib/headers/structured-field.js';

describe('parseStructuredToken', () => {
  it('reads a bare token', () => {
    expect(parseStructuredToken('same-origin')).toBe('same-origin');
  });

  it('ignores valid parameters', () => {
    expect(parseStructuredToken('require-corp; report-to="ep"')).toBe(
      'require-corp',
    );
    expect(parseStructuredToken('same-origin;flag')).toBe('same-origin');
  });

  it('rejects a quoted string', () => {
    expect(parseStructuredToken('"same-origin"')).toBeNull();
  });

  it('rejects text that is not a single item', () => {
    expect(parseStructuredToken('same origin')).toBeNull();
    expect(parseStructuredToken('a, b')).toBeNull();
    expect(parseStructuredToken('')).toBeNull();
  });

  it('rejects malformed parameters', () => {
    expect(parseStructuredToken('same-origin; Bad=1')).toBeNull();
    expect(parseStructuredToken('same-origin; k=@@')).toBeNull();
  });
});
