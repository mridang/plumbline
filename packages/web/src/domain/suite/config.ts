/**
 * @packageDocumentation
 *
 * The `plumbline.yaml` a repository can keep to choose its rules, read the way
 * ESLint reads its configuration:
 *
 * ```yaml
 * extends: plumbline:recommended      # a rule set, or a list of them
 * rules:
 *   seo-viewport: error               # off, warn, error or on
 *   technical-lazy-loading: off
 * environments:                       # changes for one kind of deployment
 *   preview:
 *     extends: plumbline:advanced
 *     rules:
 *       seo-http-status: warn
 * issues: error                       # which findings open an issue: error, warning or off
 * dispatch: true                      # send a repository_dispatch event after each run
 * ```
 *
 * A file is never required: without one a site gets `plumbline:recommended`.
 * A file with mistakes in it is not an error either; what can be read is used,
 * and each mistake is reported so it can be fixed (a check run that fails on a
 * typo in a configuration file would be worse than the typo).
 */

import { parse } from 'yaml';
import { z } from 'zod';

import { isCheckId } from '@/domain/checks/catalogue';
import { DEFAULT_RULE_SET, RULE_SETS, type Level } from '@/domain/suite/rules';

/** The file names looked for in the root of a repository, in order. */
export const CONFIG_FILES = [
  'plumbline.yaml',
  'plumbline.yml',
  'plumbline.json',
] as const;

/** The kinds of deployment a configuration can change rules for. */
export const ENVIRONMENTS = ['production', 'preview'] as const;

/** A kind of deployment: the live site, or a preview of a branch. */
export type Environment = (typeof ENVIRONMENTS)[number];

/** Which findings open an issue on production. */
export type IssueLevel = 'error' | 'warning' | 'off';

/** The keys a configuration file understands, so the others can be reported. */
const TOP_KEYS = ['extends', 'rules', 'environments', 'issues', 'dispatch'];
const OVERLAY_KEYS = ['extends', 'rules'];

const OverlaySchema = z.object({
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
});

const ConfigSchema = OverlaySchema.extend({
  issues: z.enum(['error', 'warning', 'off']).optional(),
  dispatch: z.boolean().optional(),
  environments: z.record(z.string(), OverlaySchema).optional(),
});

/** Rule sets and rules to add on top of what came before. */
export interface Overlay {
  /** The rule sets, in order; undefined when the file does not say. */
  readonly extends: readonly string[] | undefined;
  readonly rules: Readonly<Record<string, unknown>>;
}

/** A configuration file as read: what it says and what is wrong with it. */
export interface LoadedConfig extends Overlay {
  /** The file it was read from. */
  readonly path: string;
  readonly environments: Readonly<Partial<Record<Environment, Overlay>>>;
  readonly issues: IssueLevel;
  /** Whether to send a `repository_dispatch` event after each run. */
  readonly dispatch: boolean;
  /** Everything that could not be understood, one sentence each. */
  readonly problems: readonly string[];
}

/** The names of a `extends` value. */
function namesOf(value: string | string[] | undefined): string[] | undefined {
  return value === undefined ? undefined : [value].flat();
}

/** A configuration that says nothing, with `problems` explaining why. */
function empty(path: string, problems: readonly string[]): LoadedConfig {
  return {
    path,
    extends: undefined,
    rules: {},
    environments: {},
    issues: 'error',
    dispatch: false,
    problems,
  };
}

/** The unknown keys of `value`, as sentences. */
function strayKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  where: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `Unknown key "${key}"${where}.`);
}

/**
 * Reads a configuration file. YAML and JSON both work (JSON is YAML). Never
 * throws: a file that cannot be read gives a configuration that says nothing
 * and a problem that says why.
 */
export function parseConfig(text: string, path: string): LoadedConfig {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    const reason = String(error instanceof Error ? error.message : error);
    return empty(path, [
      `${path} could not be read: ${reason.split('\n')[0] ?? reason}`,
    ]);
  }
  if (raw === null || raw === undefined) {
    return empty(path, []);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return empty(path, [`${path} must be a mapping of settings.`]);
  }
  const record = raw as Record<string, unknown>;
  const problems = strayKeys(record, TOP_KEYS, ` in ${path}`);
  const parsed = ConfigSchema.safeParse(record);
  if (!parsed.success) {
    return empty(path, [
      ...problems,
      ...parsed.error.issues.map(
        (issue) =>
          `${path}: ${issue.path.join('.') || 'the file'} ${issue.message.toLowerCase()}.`,
      ),
    ]);
  }
  const config = parsed.data;
  const environments: Partial<Record<Environment, Overlay>> = {};
  for (const [name, overlay] of Object.entries(config.environments ?? {})) {
    const environment = ENVIRONMENTS.find((known) => known === name);
    if (!environment) {
      problems.push(
        `Unknown environment "${name}" in ${path}; use ${ENVIRONMENTS.join(' or ')}.`,
      );
      continue;
    }
    problems.push(
      ...strayKeys(
        (record['environments'] as Record<string, Record<string, unknown>>)[
          name
        ] ?? {},
        OVERLAY_KEYS,
        ` in the ${name} environment of ${path}`,
      ),
    );
    environments[environment] = {
      extends: namesOf(overlay.extends),
      rules: overlay.rules ?? {},
    };
  }
  return {
    path,
    extends: namesOf(config.extends),
    rules: config.rules ?? {},
    environments,
    issues: config.issues ?? 'error',
    dispatch: config.dispatch ?? false,
    problems,
  };
}

/**
 * The level a configuration value stands for, or undefined when it is not one.
 * Like ESLint, a number (0, 1, 2) or a one-item list works too.
 */
export function parseLevel(value: unknown): Level | undefined {
  if (Array.isArray(value)) {
    return value.length === 1 ? parseLevel(value[0]) : undefined;
  }
  if (value === true || value === 'on') {
    return 'on';
  }
  if (value === false || value === 0 || value === '0' || value === 'off') {
    return 'off';
  }
  if (value === 1 || value === '1' || value === 'warn' || value === 'warning') {
    return 'warn';
  }
  if (value === 2 || value === '2' || value === 'error') {
    return 'error';
  }
  return undefined;
}

/** The rules a deployment is checked with, and what to tell the people who wrote the configuration. */
export interface ResolvedRules {
  /** The level of every rule that is not off, by rule id. */
  readonly levels: ReadonlyMap<string, Level>;
  /** Which findings open an issue. */
  readonly issues: IssueLevel;
  /** Whether to send a `repository_dispatch` event after each run. */
  readonly dispatch: boolean;
  /** The mistakes in the configuration. */
  readonly problems: readonly string[];
  /** The file the rules came from; null when the repository has none. */
  readonly source: string | null;
}

/**
 * The rules for a kind of deployment: the rule sets the file extends (the
 * recommended one when it says nothing), then its `rules`, then the changes
 * it makes for that environment. A later setting wins over an earlier one.
 */
export function resolveRules(
  loaded: LoadedConfig | null,
  environment: Environment,
): ResolvedRules {
  const levels = new Map<string, Level>();
  const problems = [...(loaded?.problems ?? [])];
  const apply = (overlay: Overlay, where: string): void => {
    for (const name of overlay.extends ?? []) {
      const set = Object.hasOwn(RULE_SETS, name) ? RULE_SETS[name] : undefined;
      if (!set) {
        problems.push(`Unknown rule set "${name}" in ${where}.`);
        continue;
      }
      for (const [id, level] of Object.entries(set)) {
        levels.set(id, level);
      }
    }
    for (const [id, value] of Object.entries(overlay.rules)) {
      const level = parseLevel(value);
      if (level === undefined) {
        problems.push(
          `Rule "${id}" in ${where} is set to ${JSON.stringify(value)}; use off, warn, error or on.`,
        );
      } else if (!isCheckId(id)) {
        problems.push(`Unknown rule "${id}" in ${where}.`);
      } else {
        levels.set(id, level);
      }
    }
  };
  const path = loaded?.path ?? 'the configuration';
  apply(
    {
      extends: loaded?.extends ?? [DEFAULT_RULE_SET],
      rules: loaded?.rules ?? {},
    },
    path,
  );
  const overlay = loaded?.environments[environment];
  if (overlay) {
    apply(overlay, `the ${environment} environment of ${path}`);
  }
  for (const [id, level] of levels) {
    if (level === 'off') {
      levels.delete(id);
    }
  }
  return {
    levels,
    issues: loaded?.issues ?? 'error',
    dispatch: loaded?.dispatch ?? false,
    problems,
    source: loaded?.path ?? null,
  };
}
