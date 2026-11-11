import { describe, expect, it } from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

import { CHECKS } from '@/domain/checks/catalogue';
import {
  CONFIG_FILES,
  ENVIRONMENTS,
  parseConfig,
  parseLevel,
  resolveRules,
} from '@/domain/suite/config';
import {
  EXAMPLES,
  SCHEMA_PATH,
  SCHEMA_URL,
  buildSchema,
  undocumentedKeys,
  type JsonSchema,
} from '@/domain/suite/config-schema';
import { RULE_SET_DEFS } from '@/domain/checks/sets';
import { DEFAULT_RULE_SET } from '@/domain/suite/rules';

const schema = buildSchema();
const validate = new Ajv2020({ strict: true }).compile(schema);

/** The text of a file the reader takes, as the editor sees it once parsed. */
const valid = (text: string): boolean => validate(parse(text));

/** Whether the reader finds nothing to report in the text, for both kinds of deployment. */
function readerAccepts(text: string): boolean {
  const loaded = parseConfig(text, 'plumbline.yaml');
  return (
    loaded.problems.length === 0 &&
    ENVIRONMENTS.every(
      (environment) => resolveRules(loaded, environment).problems.length === 0,
    )
  );
}

/** Files, as written, and whether they are right. The reader and the schema must agree on each. */
const FILES: readonly [string, string, boolean][] = [
  ['a file that says nothing but an empty mapping', '{}', true],
  ['a rule set by name', 'extends: plumbline:recommended', true],
  [
    'a list of rule sets',
    'extends: [plumbline:recommended, plumbline:advanced]',
    true,
  ],
  ['an empty list of rule sets', 'extends: []', true],
  ['a rule turned off', 'rules:\n  seo-viewport: off', true],
  ['a rule turned on that no set has', 'rules:\n  mail-dmarc: error', true],
  [
    'the level words',
    'rules:\n  seo-viewport: warning\n  seo-links: warn\n  seo-http-status: on',
    true,
  ],
  ['booleans', 'rules:\n  seo-viewport: true\n  seo-links: false', true],
  [
    'numbers',
    'rules:\n  seo-viewport: 2\n  seo-links: 1\n  seo-http-status: 0',
    true,
  ],
  [
    'numbers as text',
    'rules:\n  seo-viewport: "2"\n  seo-links: "1"\n  seo-http-status: "0"',
    true,
  ],
  [
    'a list of one level, as ESLint writes it',
    'rules:\n  seo-viewport: [error]',
    true,
  ],
  ['issues and dispatch', 'issues: warning\ndispatch: true', true],
  ['issues off', 'issues: off', true],
  ['checks off', 'enabled: false', true],
  ['checks on', 'enabled: true', true],
  [
    'an environment of each kind',
    'environments:\n  production:\n    rules:\n      seo-links: off\n  preview:\n    extends: plumbline:advanced',
    true,
  ],
  [
    'JSON',
    '{"extends": "plumbline:advanced", "rules": {"seo-viewport": "error"}}',
    true,
  ],
  [
    'sites as addresses and host names',
    'sites:\n  - https://api.example.com\n  - app.example.com',
    true,
  ],
  ['no sites', 'sites: []', true],
  [
    'the environments whose deployments are sites',
    'deployments:\n  environments: [production, "prd_*"]',
    true,
  ],
  ['deployments that say nothing', 'deployments: {}', true],
  [
    'previews mapped to sites',
    'previews:\n  "pr-*": app.example.com\n  preview: https://api.example.com',
    true,
  ],
  ['sites that are not a list', 'sites: api.example.com', false],
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  ['a site that is not https', 'sites:\n  - http://api.example.com', false],
  ['a site that is not a string', 'sites:\n  - 5', false],
  [
    'a key deployments does not have',
    'deployments:\n  environment: production',
    false,
  ],
  [
    'environments that are not a list',
    'deployments:\n  environments: production',
    false,
  ],
  [
    'a preview mapped to something that is not a host',
    'previews:\n  "pr-*": 5',
    false,
  ],
  ['a key the file does not have', 'extend: plumbline:advanced', false],
  ['a rule set that does not exist', 'extends: plumbline:strict', false],
  [
    'a rule set that does not exist in a list',
    'extends: [plumbline:recommended, plumbline:strict]',
    false,
  ],
  ['a rule that does not exist', 'rules:\n  seo-vieport: error', false],
  ['a level that does not exist', 'rules:\n  seo-viewport: loud', false],
  ['a number that is not a level', 'rules:\n  seo-viewport: 3', false],
  ['a list of two levels', 'rules:\n  seo-viewport: [error, off]', false],
  ['a list of no levels', 'rules:\n  seo-viewport: []', false],
  ['issues that are not a level', 'issues: always', false],
  ['dispatch that is not a boolean', 'dispatch: yes please', false],
  ['enabled that is not a boolean', 'enabled: "no"', false],
  ['enabled that is a list', 'enabled: [false]', false],
  [
    'enabled inside an environment',
    'environments:\n  preview:\n    enabled: false',
    false,
  ],
  [
    'an environment that does not exist',
    'environments:\n  staging:\n    rules: {}',
    false,
  ],
  [
    'a key an environment does not have',
    'environments:\n  preview:\n    issues: off',
    false,
  ],
  ['rules that are a list', 'rules:\n  - seo-viewport', false],
  ['extends that is a number', 'extends: 5', false],
  ['a file that is a list', '- extends: plumbline:advanced', false],
];

describe('buildSchema', () => {
  it('is a draft 2020-12 schema that names itself by the address it is served at', () => {
    expect(schema['$schema']).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    expect(schema['$id']).toBe(SCHEMA_URL);
    expect(SCHEMA_URL.endsWith(SCHEMA_PATH)).toBe(true);
  });

  it('refuses keys it does not know, at the top and in an environment', () => {
    const defs = schema['$defs'] as Record<string, JsonSchema>;
    expect(schema['additionalProperties']).toBe(false);
    expect(defs['overlay']?.['additionalProperties']).toBe(false);
    expect(defs['environments']?.['additionalProperties']).toBe(false);
    expect(defs['rules']?.['additionalProperties']).toBe(false);
  });

  it('has every key of the reader, with the same names', () => {
    expect(
      Object.keys(schema['properties'] as object).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual([
      'deployments',
      'dispatch',
      'enabled',
      'environments',
      'extends',
      'issues',
      'previews',
      'rules',
      'sites',
    ]);
  });

  it('describes enabled as a boolean that turns the repository off, true by default', () => {
    const enabled = (schema['properties'] as Record<string, JsonSchema>)[
      'enabled'
    ];
    expect(enabled).toMatchObject({ title: 'Enabled', type: 'boolean' });
    expect(String(enabled?.['description'])).toContain('false');
    expect(String(enabled?.['description'])).toContain('turn every check');
  });

  it('lists every check of the catalogue as a rule, with its name and what it looks at', () => {
    const rules = (schema['$defs'] as Record<string, JsonSchema>)['rules'];
    const properties = rules?.['properties'] as Record<string, JsonSchema>;
    expect(
      Object.keys(properties).toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(
      CHECKS.map((check) => check.id).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
    for (const check of CHECKS) {
      expect(properties[check.id]).toMatchObject({
        title: check.name,
        description: check.description,
      });
    }
  });

  it('lists every rule set, and the environments of the reader', () => {
    const defs = schema['$defs'] as Record<string, JsonSchema>;
    const name = (defs['extends']?.['anyOf'] as JsonSchema[])[0] as JsonSchema;
    expect(
      ((name['anyOf'] as JsonSchema[])[0]!['oneOf'] as { const: string }[])
        .map((set) => set.const)
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(
      RULE_SET_DEFS.map((set) => set.id).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
    expect(
      Object.keys(defs['environments']?.['properties'] as object).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(
      [...ENVIRONMENTS].toSorted((a, b) => Number(a > b) - Number(a < b)),
    );
    expect(defs['extends']?.['default']).toBe(DEFAULT_RULE_SET);
  });

  it('has help written for every key, so a new one is not shown bare', () => {
    expect(undocumentedKeys()).toEqual([]);
  });

  it('takes the files the reader looks for as one kind of file', () => {
    expect(schema['description']).toContain(CONFIG_FILES.join(', '));
  });

  it('serialises, so it can be served', () => {
    const served = JSON.stringify(schema);
    expect(JSON.parse(served)).toEqual(schema);
  });
});

describe('the schema and the reader', () => {
  it.each(FILES)('agree on %s', (_name, text, right) => {
    expect(valid(text)).toBe(right);
    expect(readerAccepts(text)).toBe(right);
  });

  it('agree on every value a level can be written as', () => {
    const values: unknown[] = [
      'off',
      'on',
      'warn',
      'warning',
      'error',
      'loud',
      'ERROR',
      '',
      true,
      false,
      0,
      1,
      2,
      3,
      -1,
      1.5,
      '0',
      '1',
      '2',
      '3',
      ['error'],
      [0],
      [true],
      [],
      ['error', 'off'],
      [['error']],
      null,
      {},
    ];
    for (const value of values) {
      const accepted = validate({ rules: { 'seo-viewport': value } });
      expect([value, accepted]).toEqual([
        value,
        parseLevel(value) !== undefined,
      ]);
    }
  });
});

describe('groups and pins', () => {
  it('agree between the schema and the reader', () => {
    const texts = [
      'rules:\n  "tag:seo": warn\n',
      'rules:\n  "tier:experimental": off\n',
      'extends: plumbline:recommended@1\n',
      'extends: [plumbline:advanced@2]\n',
      'rules:\n  "tag:": warn\n',
      'rules:\n  seo: warn\n',
      'extends: plumbline:recommended@x\n',
    ];
    expect(texts.map((text) => [valid(text), readerAccepts(text)])).toEqual([
      [true, true],
      [true, true],
      [true, true],
      [true, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });
});

describe('the examples', () => {
  it.each(EXAMPLES.map((example, index) => [index, example] as const))(
    'example %i is valid and read without a problem',
    (_index, example) => {
      expect(validate(example)).toBe(true);
      expect(readerAccepts(JSON.stringify(example))).toBe(true);
    },
  );

  it('are listed in the schema for the editor', () => {
    expect(schema['examples']).toEqual(EXAMPLES);
  });
});
