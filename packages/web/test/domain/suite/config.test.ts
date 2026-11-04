import { describe, expect, it } from '@jest/globals';

import {
  CONFIG_FILES,
  parseConfig,
  parseLevel,
  resolveRules,
} from '@/domain/suite/config';
import { RULE_SETS, SERVER_RULES } from '@/domain/suite/rules';

const resolve = (
  text: string | null,
  environment: 'production' | 'preview' = 'production',
) =>
  resolveRules(
    text === null ? null : parseConfig(text, 'plumbline.yaml'),
    environment,
  );

describe('CONFIG_FILES', () => {
  it('looks for YAML first and also takes JSON', () => {
    expect(CONFIG_FILES).toEqual([
      'plumbline.yaml',
      'plumbline.yml',
      'plumbline.json',
    ]);
  });
});

describe('parseLevel', () => {
  it.each([
    ['off', 'off'],
    [false, 'off'],
    [0, 'off'],
    ['0', 'off'],
    ['warn', 'warn'],
    ['warning', 'warn'],
    [1, 'warn'],
    ['1', 'warn'],
    ['error', 'error'],
    [2, 'error'],
    ['2', 'error'],
    ['on', 'on'],
    [true, 'on'],
    [['error'], 'error'],
  ])('reads %p as %p', (value, level) => {
    expect(parseLevel(value)).toBe(level);
  });

  it.each([['loud'], [3], [null], [['error', { max: 1 }]], [[]], [{}]])(
    'does not read %p',
    (value) => {
      expect(parseLevel(value)).toBeUndefined();
    },
  );
});

describe('with no configuration file', () => {
  it('uses the recommended rules and opens issues for errors', () => {
    const rules = resolve(null);
    expect([...rules.levels.keys()].toSorted()).toEqual(
      Object.keys(RULE_SETS['plumbline:recommended']!).toSorted(),
    );
    expect(rules).toMatchObject({
      issues: 'error',
      source: null,
      problems: [],
      browserOnly: [],
    });
  });

  it('uses the same rules for a preview', () => {
    expect([...resolve(null, 'preview').levels]).toEqual([
      ...resolve(null).levels,
    ]);
  });
});

describe('a configuration file', () => {
  it('starts from the recommended rules when it does not extend anything', () => {
    const rules = resolve('rules:\n  seo-viewport: warn\n');
    expect(rules.levels.get('seo-viewport')).toBe('warn');
    expect(rules.levels.get('seo-links')).toBe('on');
    expect(rules.source).toBe('plumbline.yaml');
  });

  it('can start from the advanced set', () => {
    const rules = resolve('extends: plumbline:advanced\n');
    expect([...rules.levels.keys()].toSorted()).toEqual(
      [...SERVER_RULES].toSorted(),
    );
  });

  it('lets a later rule set win over an earlier one', () => {
    const rules = resolve(
      'extends: [plumbline:advanced, plumbline:recommended]\nrules:\n  seo-content-length: error\n',
    );
    expect(rules.levels.get('seo-content-length')).toBe('error');
    expect(rules.levels.get('seo-links')).toBe('on');
  });

  it('starts from nothing when it extends an empty list', () => {
    const rules = resolve('extends: []\nrules:\n  seo-links: error\n');
    expect([...rules.levels]).toEqual([['seo-links', 'error']]);
  });

  it('turns a rule off', () => {
    const rules = resolve('rules:\n  seo-viewport: off\n');
    expect(rules.levels.has('seo-viewport')).toBe(false);
  });

  it('turns on a rule that is in no rule set', () => {
    const rules = resolve('rules:\n  seo-content-length: warn\n');
    expect(rules.levels.get('seo-content-length')).toBe('warn');
  });

  it('reads JSON', () => {
    const rules = resolveRules(
      parseConfig('{"rules": {"seo-viewport": "error"}}', 'plumbline.json'),
      'production',
    );
    expect(rules.levels.get('seo-viewport')).toBe('error');
    expect(rules.source).toBe('plumbline.json');
  });

  it('takes an empty file for no settings at all', () => {
    expect(resolve('')).toMatchObject({
      problems: [],
      source: 'plumbline.yaml',
    });
    expect(resolve('# nothing yet\n').problems).toEqual([]);
  });

  it('chooses which findings open an issue', () => {
    expect(resolve('issues: warning\n').issues).toBe('warning');
    expect(resolve('issues: off\n').issues).toBe('off');
  });

  it('sends no repository_dispatch event unless the file asks for it', () => {
    expect(resolve('').dispatch).toBe(false);
    expect(resolve('dispatch: true\n').dispatch).toBe(true);
    expect(resolve('dispatch: false\n').dispatch).toBe(false);
    expect(resolve('dispatch: yes please\n').dispatch).toBe(false);
  });
});

describe('the changes for an environment', () => {
  const text = [
    'rules:',
    '  seo-viewport: error',
    'environments:',
    '  preview:',
    '    extends: plumbline:advanced',
    '    rules:',
    '      seo-viewport: warn',
    '      seo-links: off',
    '  production:',
    '    rules:',
    '      technical-html-size: error',
  ].join('\n');

  it('apply to the preview and not to production', () => {
    const preview = resolve(text, 'preview');
    const production = resolve(text, 'production');
    expect(preview.levels.get('seo-viewport')).toBe('warn');
    expect(preview.levels.has('seo-links')).toBe(false);
    expect(preview.levels.has('seo-content-length')).toBe(true);
    expect(production.levels.get('seo-viewport')).toBe('error');
    expect(production.levels.has('seo-content-length')).toBe(false);
  });

  it('apply to production when it is the one named', () => {
    expect(resolve(text).levels.get('technical-html-size')).toBe('error');
    expect(resolve(text, 'preview').levels.get('technical-html-size')).toBe(
      'on',
    );
  });
});

describe('names that are not rule sets', () => {
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'does not take %s for a rule set',
    (name) => {
      const rules = resolve(`extends: ${name}\n`);
      expect(rules.problems).toEqual([
        `Unknown rule set "${name}" in plumbline.yaml.`,
      ]);
      expect(rules.levels.size).toBe(0);
    },
  );
});

describe('rules that only run in the browser scan', () => {
  it('are accepted and listed, so the person is told they are not run here', () => {
    const rules = resolve('rules:\n  dnssec-valid: error\n  mail-spf: warn\n');
    expect(rules.problems).toEqual([]);
    expect(rules.browserOnly).toEqual(['dnssec-valid', 'mail-spf']);
  });

  it('are not listed when they are off', () => {
    expect(resolve('rules:\n  dnssec-valid: off\n').browserOnly).toEqual([]);
  });

  it('can be turned on for previews only', () => {
    const text =
      'environments:\n  preview:\n    rules:\n      dnssec-valid: error\n';
    expect(resolve(text, 'preview').browserOnly).toEqual(['dnssec-valid']);
    expect(resolve(text, 'production').browserOnly).toEqual([]);
  });
});

describe('mistakes in a configuration file', () => {
  it('are reported and do not stop the rest from being used', () => {
    const rules = resolve(
      [
        'rules:',
        '  not-a-rule: error',
        '  seo-viewport: loud',
        '  seo-links: warn',
        'extends: plumbline:nope',
        'colour: blue',
      ].join('\n'),
    );
    expect(rules.problems).toEqual([
      'Unknown key "colour" in plumbline.yaml.',
      'Unknown rule set "plumbline:nope" in plumbline.yaml.',
      'Unknown rule "not-a-rule" in plumbline.yaml.',
      'Rule "seo-viewport" in plumbline.yaml is set to "loud"; use off, warn, error or on.',
    ]);
    expect(rules.levels.get('seo-links')).toBe('warn');
    expect(rules.levels.has('seo-viewport')).toBe(false);
  });

  it('include an unknown environment and a stray key inside one', () => {
    const rules = resolve(
      'environments:\n  staging:\n    rules: {}\n  preview:\n    colour: blue\n',
    );
    expect(rules.problems).toEqual([
      'Unknown environment "staging" in plumbline.yaml; use production or preview.',
      'Unknown key "colour" in the preview environment of plumbline.yaml.',
    ]);
  });

  it('include text that is not YAML', () => {
    const loaded = parseConfig('rules: [unclosed', 'plumbline.yaml');
    expect(loaded.problems).toHaveLength(1);
    expect(loaded.problems[0]).toMatch(/^plumbline\.yaml could not be read: /);
    expect(resolveRules(loaded, 'production').levels.has('seo-viewport')).toBe(
      true,
    );
  });

  it('include a file that is not a mapping', () => {
    expect(parseConfig('- a\n- b\n', 'plumbline.yaml').problems).toEqual([
      'plumbline.yaml must be a mapping of settings.',
    ]);
    expect(parseConfig('just text', 'plumbline.yaml').problems).toEqual([
      'plumbline.yaml must be a mapping of settings.',
    ]);
  });

  it('include a setting of the wrong kind', () => {
    const loaded = parseConfig('issues: loudly\nrules: 4\n', 'plumbline.yaml');
    expect(loaded.problems.length).toBeGreaterThan(0);
    expect(loaded.problems.every((p) => p.startsWith('plumbline.yaml: '))).toBe(
      true,
    );
  });
});
