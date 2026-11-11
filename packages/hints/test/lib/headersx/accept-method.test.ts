import { describe, expect, it } from '@jest/globals';
import {
  acceptPatchFindings,
  acceptPostFindings,
} from '../../../src/lib/headersx/accept-method.js';

describe('acceptPostFindings', () => {
  it('is silent when absent', () => {
    expect(acceptPostFindings(null)).toEqual([]);
  });

  it('accepts a media-type list', () => {
    expect(acceptPostFindings('application/json, text/turtle, */*')).toEqual(
      [],
    );
  });

  it('accepts a media type with parameters', () => {
    expect(acceptPostFindings('text/html; charset=utf-8')).toEqual([]);
  });

  it('warns on an empty value', () => {
    const [f] = acceptPostFindings(' '.repeat(3));
    expect(f?.severity).toBe('warning');
  });

  it('warns on a value that is not a media type', () => {
    const [f] = acceptPostFindings('json');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('Accept-Post');
  });
});

describe('acceptPatchFindings', () => {
  it('names Accept-Patch in its message', () => {
    const [f] = acceptPatchFindings('nonsense');
    expect(f?.message).toContain('Accept-Patch');
  });

  it('accepts a valid list', () => {
    expect(acceptPatchFindings('application/json-patch+json')).toEqual([]);
  });
});
