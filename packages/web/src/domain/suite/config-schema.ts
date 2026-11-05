/**
 * @packageDocumentation
 *
 * The JSON Schema of `plumbline.yaml`, for the editor: a repository's file
 * points at it (`# yaml-language-server: $schema=…`) and the editor then
 * completes the keys, lists every rule with what it checks, and underlines a
 * mistake as the reader (`config.ts`, `rules.ts`) would report it.
 *
 * It is built from the same definitions the reader uses, not written by hand:
 * the keys come from the reader's zod schema, the environments from
 * `ENVIRONMENTS`, the rule sets from `RULE_SETS` and the rules from the
 * catalogue of checks, so a check or a rule set added later shows up here with
 * no change. The reader is lenient on purpose (a typo in a file reports a
 * problem and the rest is still used), so this schema is the strict side of
 * it: it refuses exactly what the reader reports as a problem, and the tests
 * hold the two to each other.
 */

import { z } from 'zod';

import { CHECKS } from '@/domain/checks/catalogue';
import {
  CONFIG_FILES,
  ConfigSchema,
  ENVIRONMENTS,
  OverlaySchema,
} from '@/domain/suite/config';
import { DEFAULT_RULE_SET, RULE_SETS } from '@/domain/suite/rules';
import { SITE_URL } from '@/utils/site';

/** Where the schema is served, and so its `$id`. */
export const SCHEMA_PATH = '/schemas/plumbline.schema.json';

/** The address of the schema. */
export const SCHEMA_URL = `${SITE_URL}${SCHEMA_PATH}`;

/** A JSON Schema, or a piece of one. */
export type JsonSchema = Record<string, unknown>;

/** The words a level can be written as. */
const LEVEL_WORDS = ['off', 'on', 'warn', 'warning', 'error'] as const;

/** A level as one value: a word, a boolean (`true` is on, `false` is off) or an ESLint-style number. */
const LevelScalar = z.union([
  z.enum(LEVEL_WORDS),
  z.boolean(),
  z.literal([0, 1, 2]),
  z.literal(['0', '1', '2']),
]);

/** What `parseLevel` takes: a level, or a list of exactly one level (as ESLint writes `["error", {…}]`). */
const LevelInput = z.union([LevelScalar, z.tuple([LevelScalar])]);

/** The schema of a piece of the reader's schema, without its own `$schema`. */
function jsonOf(schema: z.ZodType): JsonSchema {
  const generated = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
  }) as JsonSchema;
  return Object.fromEntries(
    Object.entries(generated).filter(([key]) => key !== '$schema'),
  );
}

/** The title and help the editor shows for a key of the file. */
const KEY_DOCS: Readonly<Record<string, { title: string; text: string }>> = {
  extends: {
    title: 'Rule sets',
    text: `The rule sets to start from, in order; a later one wins over an earlier one. Leave it out for ${DEFAULT_RULE_SET}. An empty list starts from no rules at all.`,
  },
  rules: {
    title: 'Rules',
    text: 'Changes to single rules, applied after the rule sets. A rule is a check of the catalogue; a rule that is in no rule set is off until it is turned on here.',
  },
  issues: {
    title: 'Issues',
    text: 'Which findings open a GitHub issue on the live site: only errors (the default), errors and warnings, or none.',
  },
  dispatch: {
    title: 'Repository dispatch',
    text: 'Send a repository_dispatch event after each run (plumbline.checked, and plumbline.failed when there are errors), so a workflow can react.',
  },
  environments: {
    title: 'Environments',
    text: 'Changes for one kind of deployment, applied after everything above: production is the live site, preview is a preview of a branch or pull request.',
  },
};

/** What each rule set is for, as the editor lists it. */
const SET_DOCS: Readonly<Record<string, string>> = {
  'plumbline:recommended':
    'What a site with no file gets: the checks whose findings are worth acting on.',
  'plumbline:advanced':
    'The recommended rules and the advisory content and performance rules.',
};

/** What each environment is, for the editor. */
const ENVIRONMENT_DOCS: Readonly<Record<string, string>> = {
  production: 'The live site.',
  preview: 'A preview of a branch or a pull request.',
};

/** The keys of the file that have no help written for them yet; the tests keep this empty. */
export function undocumentedKeys(): string[] {
  return [
    ...Object.keys(ConfigSchema.shape),
    ...Object.keys(OverlaySchema.shape),
  ].filter((key) => !Object.hasOwn(KEY_DOCS, key));
}

/** The rule sets that have no help written for them yet; the tests keep this empty. */
export function undocumentedRuleSets(): string[] {
  return Object.keys(RULE_SETS).filter(
    (name) => !Object.hasOwn(SET_DOCS, name),
  );
}

/** Files that show what a file looks like, checked against the reader by the tests and shown in the editor's completion. */
export const EXAMPLES: readonly JsonSchema[] = [
  {
    extends: 'plumbline:recommended',
    rules: { 'seo-viewport': 'error', 'technical-lazy-loading': 'off' },
  },
  {
    extends: ['plumbline:advanced'],
    issues: 'warning',
    dispatch: true,
    environments: { preview: { rules: { 'seo-http-status': 'warn' } } },
  },
];

/** The schema of `extends`: one rule set, or a list of them. */
function extendsSchema(): JsonSchema {
  const name: JsonSchema = {
    title: 'A rule set',
    oneOf: Object.keys(RULE_SETS).map((set) => ({
      const: set,
      description: SET_DOCS[set] ?? 'A rule set.',
    })),
  };
  return {
    title: KEY_DOCS['extends']?.title,
    description: KEY_DOCS['extends']?.text,
    default: DEFAULT_RULE_SET,
    anyOf: [
      name,
      { type: 'array', items: name, uniqueItems: true, title: 'Rule sets' },
    ],
  };
}

/** The schema of `rules`: every check of the catalogue, each with its level. */
function rulesSchema(): JsonSchema {
  return {
    title: KEY_DOCS['rules']?.title,
    description: KEY_DOCS['rules']?.text,
    type: 'object',
    properties: Object.fromEntries(
      CHECKS.map((check) => [
        check.id,
        {
          $ref: '#/$defs/level',
          title: check.name,
          description: check.description,
        },
      ]),
    ),
    additionalProperties: false,
  };
}

/** The schema of what an environment can change: the same rule sets and rules, and nothing else. */
function overlaySchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      extends: { $ref: '#/$defs/extends' },
      rules: { $ref: '#/$defs/rules' },
    },
    additionalProperties: false,
  };
}

/** The schema of `environments`: the kinds of deployment there are. */
function environmentsSchema(): JsonSchema {
  return {
    title: KEY_DOCS['environments']?.title,
    description: KEY_DOCS['environments']?.text,
    type: 'object',
    properties: Object.fromEntries(
      ENVIRONMENTS.map((name) => [
        name,
        {
          $ref: '#/$defs/overlay',
          title: name,
          description: ENVIRONMENT_DOCS[name] ?? 'A kind of deployment.',
        },
      ]),
    ),
    additionalProperties: false,
  };
}

/** The keys that need more than the reader's own type, built above. */
const OWN: Readonly<Record<string, string>> = {
  extends: '#/$defs/extends',
  rules: '#/$defs/rules',
  environments: '#/$defs/environments',
};

/**
 * The schema of `plumbline.yaml` (and `plumbline.yml` and `plumbline.json`,
 * which are read the same way). Keys the reader takes that need no more than
 * their type, such as `issues` and `dispatch`, are generated straight from its
 * zod schema.
 */
export function buildSchema(): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, type] of Object.entries(ConfigSchema.shape)) {
    const own = Object.hasOwn(OWN, key) ? OWN[key] : undefined;
    properties[key] = own
      ? { $ref: own }
      : {
          title: KEY_DOCS[key]?.title,
          description: KEY_DOCS[key]?.text,
          ...jsonOf(type),
        };
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: SCHEMA_URL,
    title: 'plumbline.yaml',
    description: `The rules Plumbline checks a repository's sites with (${CONFIG_FILES.join(', ')}, in the root of the repository). Everything is optional: with no file, a site gets ${DEFAULT_RULE_SET}.`,
    type: 'object',
    properties,
    additionalProperties: false,
    examples: EXAMPLES,
    $defs: {
      level: {
        title: 'Level',
        description:
          'off turns the rule off; warn and error report everything it finds as that severity; on reports each finding with the severity the check gave it. true, false, 0, 1 and 2 work too, as in ESLint.',
        ...jsonOf(LevelInput),
      },
      extends: extendsSchema(),
      rules: rulesSchema(),
      overlay: overlaySchema(),
      environments: environmentsSchema(),
    },
  };
}
