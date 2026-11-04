import { describe, expect, it } from '@jest/globals';
import { EXIT, exitCodeFor, severityRank } from '../src/exit-code.js';

const findings = (...severities: string[]) =>
  severities.map((severity) => ({ severity }));

describe('exitCodeFor', () => {
  it.each([
    ['error', findings('error'), EXIT.findings],
    ['error', findings('warning', 'hint'), EXIT.ok],
    ['warning', findings('warning'), EXIT.findings],
    ['warning', findings('error'), EXIT.findings],
    ['warning', findings('hint', 'information'), EXIT.ok],
    ['none', findings('error'), EXIT.ok],
    ['error', findings(), EXIT.ok],
  ] as const)('with --fail-on %s and %j exits %i', (failOn, list, expected) => {
    expect(exitCodeFor(list, failOn)).toBe(expected);
  });

  it('treats an unknown severity as below every threshold', () => {
    expect(exitCodeFor(findings('off'), 'warning')).toBe(EXIT.ok);
  });
});

describe('severityRank', () => {
  it('orders the severities most serious last', () => {
    const order = ['information', 'hint', 'warning', 'error'].map(severityRank);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(4);
  });

  it('ranks an unknown severity lowest', () => {
    expect(severityRank('off')).toBe(0);
  });
});
