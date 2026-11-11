import { describe, expect, it } from '@jest/globals';

import {
  CONFIG_FILES,
  parseConfig,
  parseLevel,
  resolveRules,
} from '@/domain/suite/config';
import { findCheck } from '@/domain/checks/catalogue';
import { RULE_SETS } from '@/domain/suite/rules';

/** A rule of the advanced set that the recommended set does not hold. */
const ADV = Object.keys(RULE_SETS['plumbline:advanced']!).find(
  (id) => !(id in RULE_SETS['plumbline:recommended']!),
)!;

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

  it.each([
    ['loud'],
    [3],
    [null],
    [['error', { max: 1 }]],
    [[]],
    [[['error']]],
    [{}],
  ])('does not read %p', (value) => {
    expect(parseLevel(value)).toBeUndefined();
  });
});

describe('with no configuration file', () => {
  it('uses the recommended rules and opens issues for errors', () => {
    const rules = resolve(null);
    expect(
      [...rules.levels.keys()].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(
      Object.keys(RULE_SETS['plumbline:recommended']!).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
    expect(rules).toMatchObject({
      issues: 'error',
      source: null,
      problems: [],
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
    expect(rules.levels.get('seo-title-missing')).toBe('on');
    expect(rules.source).toBe('plumbline.yaml');
  });

  it('can start from the advanced set', () => {
    const rules = resolve('extends: plumbline:advanced\n');
    expect(
      [...rules.levels.keys()].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(
      Object.keys(RULE_SETS['plumbline:advanced']!).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
  });

  it('lets a later rule set win over an earlier one', () => {
    const rules = resolve(
      `extends: [plumbline:advanced, plumbline:recommended]\nrules:\n  ${ADV}: error\n`,
    );
    expect(rules.levels.get(ADV)).toBe('error');
    expect(rules.levels.get('seo-title-missing')).toBe('on');
  });

  it('starts from nothing when it extends an empty list', () => {
    const rules = resolve('extends: []\nrules:\n  seo-title-missing: error\n');
    expect([...rules.levels]).toEqual([['seo-title-missing', 'error']]);
  });

  it('turns a rule off', () => {
    const rules = resolve('rules:\n  seo-viewport: off\n');
    expect(rules.levels.has('seo-viewport')).toBe(false);
  });

  it('turns on a rule that is in no rule set', () => {
    const rules = resolve(`rules:\n  ${ADV}: warn\n`);
    expect(rules.levels.get(ADV)).toBe('warn');
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

  it('has checks on unless the file says enabled: false', () => {
    expect(resolve('').enabled).toBe(true);
    expect(resolve(null).enabled).toBe(true);
    expect(resolve('extends: plumbline:advanced\n').enabled).toBe(true);
    expect(resolve('enabled: true\n').enabled).toBe(true);
    expect(resolve('enabled: false\n').enabled).toBe(false);
    expect(resolve('{"enabled": false}').enabled).toBe(false);
  });

  it('ignores a file whose enabled is not a boolean, and says so', () => {
    const rules = resolve('enabled: "no"\n');
    expect(rules.enabled).toBe(true);
    expect(rules.problems.join(' ')).toContain('enabled');
  });

  it('knows enabled at the top, but not inside an environment', () => {
    expect(resolve('enabled: false\n').problems).toEqual([]);
    expect(
      resolve('environments:\n  preview:\n    enabled: false\n').problems,
    ).toEqual([
      'Unknown key "enabled" in the preview environment of plumbline.yaml.',
    ]);
    expect(resolve('enable: false\n').problems).toEqual([
      'Unknown key "enable" in plumbline.yaml.',
    ]);
  });

  it('sends no repository_dispatch event unless the file asks for it', () => {
    expect(resolve('').dispatch).toBe(false);
    expect(resolve('dispatch: true\n').dispatch).toBe(true);
    expect(resolve('dispatch: false\n').dispatch).toBe(false);
    expect(resolve('dispatch: yes please\n').dispatch).toBe(false);
  });
});

describe('rules that name a group', () => {
  const section = findCheck('seo-viewport')!.section;
  const inSection = Object.keys(RULE_SETS['plumbline:recommended']!).filter(
    (id) => findCheck(id)!.section === section,
  );

  it('sets every rule of a section', () => {
    const rules = resolve(`rules:\n  "section:${section}": warn\n`);
    expect(inSection.length).toBeGreaterThan(1);
    expect(inSection.map((id) => rules.levels.get(id))).toEqual(
      inSection.map(() => 'warn'),
    );
  });

  it('lets a rule named on its own beat its group, whatever the order', () => {
    const rules = resolve(
      `rules:\n  seo-viewport: error\n  "section:${section}": off\n`,
    );
    expect(rules.levels.get('seo-viewport')).toBe('error');
    expect(inSection.filter((id) => rules.levels.has(id))).toEqual([
      'seo-viewport',
    ]);
  });

  it('sets the rules of a tier', () => {
    const rules = resolve('extends: []\nrules:\n  "tier:experimental": warn\n');
    expect(
      [...rules.levels.keys()].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(
      Object.keys(RULE_SETS['plumbline:experimental']!).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
  });

  it('reports a group that does not exist, and a bare word that is not a rule', () => {
    const rules = resolve('rules:\n  "tag:nope": warn\n  seo: warn\n');
    expect(rules.problems).toEqual([
      'Unknown rule "tag:nope" in plumbline.yaml.',
      'Unknown rule "seo" in plumbline.yaml.',
    ]);
  });
});

describe('a rule set pinned to a catalogue version', () => {
  it('holds only the checks that were in the catalogue by then', () => {
    const pinned = resolve('extends: plumbline:advanced@1\n');
    const current = resolve('extends: plumbline:advanced@3\n');
    expect(pinned.levels.has('dnssec-exists')).toBe(false);
    expect(current.levels.has('dnssec-exists')).toBe(true);
    expect(pinned.problems).toEqual([]);
  });

  it('reports a pin that is not a whole number', () => {
    const rules = resolve('extends: plumbline:advanced@soon\n');
    expect(rules.problems).toEqual([
      'Rule set "plumbline:advanced@soon" in plumbline.yaml has a version that is not a whole number.',
    ]);
    expect(rules.levels.size).toBe(0);
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
    '      seo-title-missing: off',
    '  production:',
    '    rules:',
    '      technical-html-size: error',
  ].join('\n');

  it('apply to the preview and not to production', () => {
    const preview = resolve(text, 'preview');
    const production = resolve(text, 'production');
    expect(preview.levels.get('seo-viewport')).toBe('warn');
    expect(preview.levels.has('seo-title-missing')).toBe(false);
    expect(preview.levels.has(ADV)).toBe(true);
    expect(production.levels.get('seo-viewport')).toBe('error');
    expect(production.levels.has(ADV)).toBe(false);
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

describe('rules for the checks the scanner container runs', () => {
  it('accept any check of the catalogue, the TLS, DNS and mail ones too', () => {
    const rules = resolve('rules:\n  dnssec-valid: error\n  mail-spf: warn\n');
    expect(rules.problems).toEqual([]);
    expect(rules.levels.get('dnssec-valid')).toBe('error');
    expect(rules.levels.get('mail-spf')).toBe('warn');
  });

  it('can turn one on for previews only', () => {
    const outside = Object.keys(RULE_SETS['plumbline:all']!).find(
      (id) => !(id in RULE_SETS['plumbline:recommended']!),
    )!;
    const text = `environments:\n  preview:\n    rules:\n      ${outside}: error\n`;
    expect(resolve(text, 'preview').levels.get(outside)).toBe('error');
    expect(resolve(text, 'production').levels.has(outside)).toBe(false);
  });
});

describe('sites', () => {
  it('declares none when the file says nothing', () => {
    expect(resolve(null)).toMatchObject({
      sites: [],
      siteEnvironments: null,
      previews: [],
    });
    expect(resolve('rules: {}\n')).toMatchObject({ sites: [] });
  });

  it('reads the hosts of the addresses and host names it lists, each once', () => {
    const rules = resolve(
      'sites:\n  - https://API.example.com/path\n  - app.example.com\n  - api.example.com\n',
    );
    expect(rules.sites).toEqual(['api.example.com', 'app.example.com']);
    expect(rules.problems).toEqual([]);
  });

  it('ignores an address that cannot be a site and says why', () => {
    const rules = resolve(
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'sites:\n  - http://plain.example.com\n  - https://github.com/acme/site\n  - localhost\n  - ok.example.com\n',
    );
    expect(rules.sites).toEqual(['ok.example.com']);
    expect(rules.problems).toEqual([
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'plumbline.yaml: "http://plain.example.com" in sites is not an https address, so it was ignored.',
      'plumbline.yaml: "https://github.com/acme/site" in sites is not a site (GitHub or a registry), so it was ignored.',
      'plumbline.yaml: "localhost" in sites is not a public domain name, so it was ignored.',
    ]);
  });

  it('reports sites that are not a list', () => {
    const rules = resolve('sites: api.example.com\n');
    expect(rules.sites).toEqual([]);
    expect(rules.problems).toHaveLength(1);
  });
});

describe('deployments', () => {
  it('lists the environments whose deployments are sites', () => {
    const rules = resolve(
      'deployments:\n  environments: [production, "prd_*"]\n',
    );
    expect(rules.siteEnvironments).toEqual(['production', 'prd_*']);
    expect(rules.problems).toEqual([]);
  });

  it('means an empty list: no environment is a site', () => {
    expect(
      resolve('deployments:\n  environments: []\n').siteEnvironments,
    ).toEqual([]);
  });

  it('reports a key it does not have, and a value that is not a list', () => {
    expect(
      resolve('deployments:\n  environment: production\n').problems,
    ).toEqual(['Unknown key "environment" in deployments of plumbline.yaml.']);
    expect(
      resolve('deployments:\n  environments: production\n').problems,
    ).toHaveLength(1);
  });
});

describe('previews', () => {
  it('maps environment names to the host of the site they are a copy of, in file order', () => {
    const rules = resolve(
      'previews:\n  "pr-*": https://App.example.com\n  preview: api.example.com\n',
    );
    expect(rules.previews).toEqual([
      ['pr-*', 'app.example.com'],
      ['preview', 'api.example.com'],
    ]);
    expect(rules.problems).toEqual([]);
  });

  it('ignores a target that cannot be a site and says why', () => {
    const rules = resolve(
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'previews:\n  "pr-*": http://app.example.com\n  ok: app.example.com\n',
    );
    expect(rules.previews).toEqual([['ok', 'app.example.com']]);
    expect(rules.problems).toEqual([
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'plumbline.yaml: "http://app.example.com" for "pr-*" in previews is not an https address, so it was ignored.',
    ]);
  });

  it('is the same for a preview and for the live site', () => {
    const text = 'previews:\n  "pr-*": app.example.com\n';
    expect(resolve(text, 'preview').previews).toEqual(
      resolve(text, 'production').previews,
    );
  });
});
