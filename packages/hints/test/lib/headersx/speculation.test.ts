import { describe, expect, it } from '@jest/globals';
import {
  speculationRulesFindings,
  supportsLoadingModeFindings,
} from '../../../src/lib/headersx/speculation.js';

describe('speculationRulesFindings', () => {
  it('is silent when absent', () => {
    expect(speculationRulesFindings(null)).toEqual([]);
  });

  it('accepts quoted ruleset URLs', () => {
    expect(
      speculationRulesFindings(
        '"/rules/prefetch.json", "/rules/prerender.json"',
      ),
    ).toEqual([]);
  });

  it('warns on an empty value', () => {
    const [f] = speculationRulesFindings(' '.repeat(3));
    expect(f?.severity).toBe('warning');
  });

  it('warns on a bare (unquoted) member', () => {
    const [f] = speculationRulesFindings('/rules.json');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('quoted');
  });

  it('warns on an empty quoted URL', () => {
    const [f] = speculationRulesFindings('""');
    expect(f?.severity).toBe('warning');
  });
});

describe('supportsLoadingModeFindings', () => {
  it('is silent when absent', () => {
    expect(supportsLoadingModeFindings(null)).toEqual([]);
  });

  it('accepts known modes', () => {
    expect(supportsLoadingModeFindings('credentialed-prerender')).toEqual([]);
    expect(supportsLoadingModeFindings('fenced-frame')).toEqual([]);
  });

  it('warns on an unrecognised mode', () => {
    const [f] = supportsLoadingModeFindings('teleport');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('teleport');
  });

  it('warns on a non-token value', () => {
    const [f] = supportsLoadingModeFindings('"x"');
    expect(f?.severity).toBe('warning');
  });
});
