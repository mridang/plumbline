import { describe, expect, it } from '@jest/globals';
import { digestFindings } from '../../../src/lib/headersx/digest.js';

describe('digestFindings', () => {
  it('is silent when absent', () => {
    expect(digestFindings('Content-Digest', null)).toEqual([]);
  });

  it('accepts a valid sha-256 byte-sequence dictionary', () => {
    expect(
      digestFindings('Content-Digest', 'sha-256=:d435Qo+nKZ+gLcUHn7GQnw==:'),
    ).toEqual([]);
  });

  it('warns when the value is not a dictionary', () => {
    const [f] = digestFindings('Repr-Digest', '   ');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('dictionary');
  });

  it('warns when a digest is not a byte sequence', () => {
    const [f] = digestFindings('Content-Digest', 'sha-256=abc');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('byte sequence');
  });

  it('warns when only an insecure algorithm is offered', () => {
    const [f] = digestFindings('Content-Digest', 'md5=:AA==:');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('insecure');
  });

  it('accepts a mix that includes a secure algorithm', () => {
    expect(
      digestFindings('Content-Digest', 'md5=:AA==:, sha-512=:BB==:'),
    ).toEqual([]);
  });
});
