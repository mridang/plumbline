import { describe, expect, it } from '@jest/globals';

import { isCheckId } from '@/domain/checks/catalogue';
import type { CheckResult } from '@/domain/suite/checks';
import {
  DEFAULT_RULE_SET,
  RULE_SETS,
  SERVER_RULES,
  applyLevels,
  fingerprintOf,
  isServerRule,
  type Level,
} from '@/domain/suite/rules';

describe('the rules the server runs', () => {
  it('are all checks of the catalogue', () => {
    expect(SERVER_RULES.filter((id) => !isCheckId(id))).toEqual([]);
  });

  it('are the checks the suite makes', () => {
    expect(isServerRule('seo-viewport')).toBe(true);
    expect(isServerRule('dnssec-valid')).toBe(false);
  });
});

describe('the rule sets', () => {
  it('start from the recommended one', () => {
    expect(DEFAULT_RULE_SET).toBe('plumbline:recommended');
  });

  it('only turn on rules the server runs', () => {
    for (const set of Object.values(RULE_SETS)) {
      expect(Object.keys(set).filter((id) => !isServerRule(id))).toEqual([]);
    }
  });

  it('have an advanced set that holds every recommended rule and more', () => {
    const recommended = Object.keys(RULE_SETS['plumbline:recommended']!);
    const advanced = Object.keys(RULE_SETS['plumbline:advanced']!);
    expect(recommended.filter((id) => !advanced.includes(id))).toEqual([]);
    expect(advanced.length).toBeGreaterThan(recommended.length);
    expect(advanced).toHaveLength(SERVER_RULES.length);
  });

  it('keep the advisory content rules out of the recommended set', () => {
    expect(RULE_SETS['plumbline:recommended']).not.toHaveProperty(
      'seo-keywords-frequent',
    );
    expect(RULE_SETS['plumbline:advanced']).toHaveProperty(
      'seo-keywords-frequent',
    );
  });
});

describe('applyLevels', () => {
  const checks: CheckResult[] = [
    {
      id: 'a',
      findings: [
        { severity: 'error', message: 'e' },
        { severity: 'hint', message: 'h' },
      ],
    },
    { id: 'b', findings: [{ severity: 'warning', message: 'w' }] },
    { id: 'c', findings: [{ severity: 'warning', message: 'x' }] },
  ];
  const apply = (...levels: [string, Level][]) =>
    applyLevels(checks, new Map(levels));

  it('keeps each finding as it is at the level on', () => {
    expect(apply(['a', 'on'])[0]?.findings.map((f) => f.severity)).toEqual([
      'error',
      'hint',
    ]);
  });

  it('makes everything an error at the level error', () => {
    expect(apply(['a', 'error'])[0]?.findings.map((f) => f.severity)).toEqual([
      'error',
      'error',
    ]);
  });

  it('makes everything a warning at the level warn', () => {
    expect(apply(['a', 'warn'])[0]?.findings.map((f) => f.severity)).toEqual([
      'warning',
      'warning',
    ]);
  });

  it('drops the findings of a rule that is off', () => {
    expect(apply(['a', 'off'])[0]?.findings).toEqual([]);
  });

  it('drops the findings of a rule that is not in the levels at all', () => {
    expect(apply(['a', 'on'])[1]?.findings).toEqual([]);
  });

  it('keeps every check in the result, found or not', () => {
    expect(apply().map((check) => check.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not change what it was given', () => {
    apply(['a', 'error']);
    expect(checks[0]?.findings[1]?.severity).toBe('hint');
  });
});

describe('fingerprintOf', () => {
  it('is the same for the same levels in any order', async () => {
    const one = await fingerprintOf(
      new Map<string, Level>([
        ['a', 'on'],
        ['b', 'warn'],
      ]),
    );
    const other = await fingerprintOf(
      new Map<string, Level>([
        ['b', 'warn'],
        ['a', 'on'],
      ]),
    );
    expect(one).toBe(other);
    expect(one).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs when a level differs or a rule is added', async () => {
    const base = await fingerprintOf(new Map<string, Level>([['a', 'on']]));
    expect(
      await fingerprintOf(new Map<string, Level>([['a', 'warn']])),
    ).not.toBe(base);
    expect(
      await fingerprintOf(
        new Map<string, Level>([
          ['a', 'on'],
          ['b', 'on'],
        ]),
      ),
    ).not.toBe(base);
  });
});
