import { describe, expect, it } from '@jest/globals';
import { frameOptionsFindings } from '../../../src/lib/headers/frame-options.js';

const obs = (header: string | null, csp = false) =>
  frameOptionsFindings({
    header,
    cspFrameAncestors: csp,
    profile: 'observatory',
  });

describe('frameOptionsFindings (observatory)', () => {
  it.each(['DENY', 'deny', 'SAMEORIGIN', ' sameorigin '])('passes %s', (v) => {
    expect(obs(v)).toEqual([]);
  });

  it('passes when CSP frame-ancestors is present', () => {
    expect(obs(null, true)).toEqual([]);
    expect(obs('bogus', true)).toEqual([]);
  });

  it('errors when nothing is set', () => {
    expect(obs(null)[0]?.message).toContain('not implemented');
  });

  it('hints on ALLOW-FROM', () => {
    const [f] = obs('ALLOW-FROM https://a.example');
    expect(f?.severity).toBe('hint');
    expect(f?.message).toContain('ALLOW-FROM');
  });

  it('errors on an unknown value', () => {
    expect(obs('bogus')[0]?.message).toContain('cannot be recognized');
  });
});

describe('frameOptionsFindings (owasp)', () => {
  const owasp = (header: string | null, csp = false) =>
    frameOptionsFindings({ header, cspFrameAncestors: csp, profile: 'owasp' });

  it('requires deny', () => {
    expect(owasp('DENY')).toEqual([]);
    expect(owasp('deny')).toEqual([]);
    expect(owasp('sameorigin')[0]?.message).toContain("'deny'");
  });

  it('does not accept CSP as a replacement', () => {
    expect(owasp(null, true)[0]?.message).toContain('not specified');
  });
});
