import { describe, expect, it } from '@jest/globals';
import {
  ageFindings,
  etagFindings,
  expiresFindings,
  lastModifiedFindings,
  noVarySearchFindings,
  varyFindings,
} from '../../../src/lib/headers/caching.js';

describe('etagFindings', () => {
  it('is silent for an opaque or weak tag', () => {
    expect(etagFindings(null)).toEqual([]);
    expect(etagFindings('"abc123"')).toEqual([]);
    expect(etagFindings('W/"abc"')).toEqual([]);
  });

  it('warns on an inode-size-mtime value', () => {
    expect(etagFindings('"12345-1b6-5e0a"')[0]?.severity).toBe('warning');
  });
});

describe('lastModifiedFindings', () => {
  it('accepts a valid HTTP-date', () => {
    expect(lastModifiedFindings('Wed, 21 Oct 2015 07:28:00 GMT')).toEqual([]);
  });

  it('warns on a malformed date', () => {
    expect(lastModifiedFindings('2015-10-21')[0]?.severity).toBe('warning');
  });
});

describe('expiresFindings', () => {
  it('accepts a valid HTTP-date without max-age', () => {
    expect(expiresFindings('Wed, 21 Oct 2015 07:28:00 GMT', false)).toEqual([]);
  });

  it('notes redundancy when max-age is present', () => {
    expect(
      expiresFindings('Wed, 21 Oct 2015 07:28:00 GMT', true)[0]?.severity,
    ).toBe('hint');
  });

  it('warns on a malformed date', () => {
    expect(expiresFindings('0', false)[0]?.severity).toBe('warning');
  });
});

describe('ageFindings', () => {
  it('accepts delta-seconds', () => {
    expect(ageFindings('60')).toEqual([]);
  });

  it('notes a malformed value', () => {
    expect(ageFindings('-1')[0]?.severity).toBe('hint');
  });
});

describe('varyFindings', () => {
  it('is silent for a named list', () => {
    expect(varyFindings('Accept-Encoding, Accept')).toEqual([]);
  });

  it('warns on a bare wildcard', () => {
    expect(varyFindings('*')[0]?.message).toContain('uncacheable');
  });

  it('warns when mixing a wildcard with names', () => {
    expect(varyFindings('*, Accept')[0]?.message).toContain('mixes');
  });
});

describe('noVarySearchFindings', () => {
  it('is silent when absent', () => {
    expect(noVarySearchFindings(null)).toEqual([]);
  });

  it('accepts recognised keys', () => {
    expect(noVarySearchFindings('key-order, params=("q")')).toEqual([]);
  });

  it('warns on an unknown key', () => {
    expect(noVarySearchFindings('wobble')[0]?.message).toContain('wobble');
  });
});
