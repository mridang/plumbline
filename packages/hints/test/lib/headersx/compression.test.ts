import { describe, expect, it } from '@jest/globals';
import { compressionDictionaryFindings } from '../../../src/lib/headersx/compression.js';

describe('compressionDictionaryFindings', () => {
  it('is silent when absent', () => {
    expect(compressionDictionaryFindings(null)).toEqual([]);
  });

  it('accepts a dictionary with a match pattern', () => {
    expect(compressionDictionaryFindings('match="/app/*", type=raw')).toEqual(
      [],
    );
  });

  it('warns when it is not a dictionary', () => {
    const [f] = compressionDictionaryFindings(' '.repeat(3));
    expect(f?.severity).toBe('warning');
  });

  it('warns when match is missing', () => {
    const [f] = compressionDictionaryFindings('id="v1"');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('match');
  });

  it('warns when match is empty', () => {
    const [f] = compressionDictionaryFindings('match=""');
    expect(f?.severity).toBe('warning');
  });

  it('warns on an unrecognised key', () => {
    const [f] = compressionDictionaryFindings('match="/a", bogus=1');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('bogus');
  });
});
