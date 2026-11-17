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
 *   "tag:seo": warn                   # a whole group: section:, tag:, target:, tier:, source:
 * environments:                       # changes for one kind of deployment
 *   preview:
 *     extends: plumbline:advanced
 *     rules:
 *       seo-http-status: warn
 * issues: error                       # which findings open an issue: error, warning or off
 * dispatch: true                      # send a repository_dispatch event after each run
 * enabled: false                      # turn every check of this repository off (default true)
 * sites:                              # addresses to check, in addition to the ones deployments report
 *   - https://api.example.com
 * deployments:
 *   environments: [production, "prd_*"]   # which deployment environments are sites (default: every one that is not a preview)
 * previews:                           # which site a preview is compared with
 *   "pr-*": api.example.com
 * ```
 *
 * A rule set can be pinned to a catalogue version (`plumbline:recommended@1`):
 * it then holds only the checks that were in the catalogue by that version.
 * A rule that names one check beats a group, whatever order they are written in.
 *
 * A file is never required: without one a site gets `plumbline:recommended`.
 * A file with mistakes in it is not an error either; what can be read is used,
 * and each mistake is reported so it can be fixed (a check run that fails on a
 * typo in a configuration file would be worse than the typo).
 */

import { parse } from 'yaml';
import { z } from 'zod';

import {
  checksInGroup,
  findCheck,
  isCheckId,
  isGroup,
} from '@/domain/checks/catalogue';
import { siteAddress } from '@/domain/suite/site-address';
import { DEFAULT_RULE_SET, RULE_SETS } from '@/domain/suite/rules';
import type { Level } from '@/domain/suite/rules';

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
const TOP_KEYS = [
  'extends',
  'rules',
  'environments',
  'issues',
  'dispatch',
  'enabled',
  'sites',
  'deployments',
  'previews',
];
const OVERLAY_KEYS = ['extends', 'rules'];
const DEPLOYMENT_KEYS = ['environments'];

/** The settings an environment can change, as the reader takes them (leniently: its mistakes are reported, not refused). */
export const OverlaySchema = z.object({
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
});

/** A whole configuration file, as the reader takes it. `config-schema.ts` builds the editor's JSON Schema from it. */
export const ConfigSchema = OverlaySchema.extend({
  issues: z.enum(['error', 'warning', 'off']).optional(),
  dispatch: z.boolean().optional(),
  enabled: z.boolean().optional(),
  environments: z.record(z.string(), OverlaySchema).optional(),
  sites: z.array(z.string()).optional(),
  deployments: z
    .object({ environments: z.array(z.string()).optional() })
    .optional(),
  previews: z.record(z.string(), z.string()).optional(),
});

/** Rule sets and rules to add on top of what came before. */
export interface Overlay {
  /** The rule sets, in order; undefined when the file does not say. */
  readonly extends?: readonly string[];
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
  /** Whether checks are on for the repository; `enabled: false` turns every check off. */
  readonly enabled: boolean;
  /** The hosts of the file's `sites` (the addresses that can be a site; the others are problems). */
  readonly sites: readonly string[];
  /** The environment-name patterns whose deployments are sites; null when the file does not say (every non-preview one). */
  readonly siteEnvironments: readonly string[] | null;
  /** Which site a preview is compared with: an environment-name pattern and the host it stands for, in file order. */
  readonly previews: readonly (readonly [string, string])[];
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
    rules: {},
    environments: {},
    issues: 'error',
    dispatch: false,
    enabled: true,
    sites: [],
    siteEnvironments: null,
    previews: [],
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
  const read = (() => {
    try {
      return { raw: parse(text) as unknown };
    } catch (error) {
      return { error };
    }
  })();
  if ('error' in read) {
    const reason = String(
      read.error instanceof Error ? read.error.message : read.error,
    );
    return empty(path, [
      `${path} could not be read: ${reason.split('\n', 1)[0] ?? reason}`,
    ]);
  }
  const { raw } = read;
  if (raw === null || raw === undefined) {
    return empty(path, []);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return empty(path, [`${path} must be a mapping of settings.`]);
  }
  const record = raw as Record<string, unknown>;
  const topProblems = strayKeys(record, TOP_KEYS, ` in ${path}`);
  const parsed = ConfigSchema.safeParse(record);
  if (!parsed.success) {
    return empty(path, [
      ...topProblems,
      ...parsed.error.issues.map(
        (issue) =>
          `${path}: ${issue.path.join('.') || 'the file'} ${issue.message.toLowerCase()}.`,
      ),
    ]);
  }
  const config = parsed.data;
  const named = Object.entries(config.environments ?? {}).map(
    ([name, overlay]) => ({
      name,
      overlay,
      environment: ENVIRONMENTS.find((known) => known === name),
    }),
  );
  const environments: Partial<Record<Environment, Overlay>> =
    Object.fromEntries(
      named.flatMap(({ overlay, environment }) =>
        environment
          ? [
              [
                environment,
                {
                  extends: namesOf(overlay.extends),
                  rules: overlay.rules ?? {},
                },
              ] as const,
            ]
          : [],
      ),
    );
  const environmentProblems = named.flatMap(({ name, environment }) =>
    environment
      ? strayKeys(
          (record['environments'] as Record<string, Record<string, unknown>>)[
            name
          ] ?? {},
          OVERLAY_KEYS,
          ` in the ${name} environment of ${path}`,
        )
      : [
          `Unknown environment "${name}" in ${path}; use ${ENVIRONMENTS.join(' or ')}.`,
        ],
  );
  const deploymentProblems = strayKeys(
    (record['deployments'] ?? {}) as Record<string, unknown>,
    DEPLOYMENT_KEYS,
    ` in deployments of ${path}`,
  );
  const sites = hostsOf(config.sites ?? [], 'sites', path);
  const previews = previewsOf(config.previews ?? {}, path);
  return {
    path,
    extends: namesOf(config.extends),
    rules: config.rules ?? {},
    environments,
    issues: config.issues ?? 'error',
    dispatch: config.dispatch ?? false,
    enabled: config.enabled ?? true,
    sites: sites.hosts,
    siteEnvironments: config.deployments?.environments ?? null,
    previews: previews.pairs,
    problems: [
      ...topProblems,
      ...environmentProblems,
      ...deploymentProblems,
      ...sites.problems,
      ...previews.problems,
    ],
  };
}

/** The distinct hosts of a list of addresses, and a problem for each one that cannot be a site. */
function hostsOf(addresses: readonly string[], where: string, path: string) {
  const sites = addresses.map((address) => ({
    address,
    site: siteAddress(address),
  }));
  return {
    hosts: [
      ...new Set(sites.flatMap(({ site }) => (site.ok ? [site.host] : []))),
    ],
    problems: sites.flatMap(({ address, site }) =>
      site.ok
        ? []
        : [
            `${path}: "${address}" in ${where} ${site.reason}, so it was ignored.`,
          ],
    ),
  };
}

/** The `previews` mapping as pattern and host pairs, and a problem for each target that cannot be a site. */
function previewsOf(mapping: Readonly<Record<string, string>>, path: string) {
  const sites = Object.entries(mapping).map(([pattern, address]) => ({
    pattern,
    address,
    site: siteAddress(address),
  }));
  return {
    pairs: sites.flatMap(({ pattern, site }) =>
      site.ok ? [[pattern, site.host] as const] : [],
    ),
    problems: sites.flatMap(({ pattern, address, site }) =>
      site.ok
        ? []
        : [
            `${path}: "${address}" for "${pattern}" in previews ${site.reason}, so it was ignored.`,
          ],
    ),
  };
}

/**
 * The level a configuration value stands for, or undefined when it is not one.
 * Like ESLint, a number (0, 1, 2) or a one-item list works too (not a list in
 * a list).
 */
const OFF_LEVELS: ReadonlySet<unknown> = new Set<unknown>([
  false,
  0,
  '0',
  'off',
]);
const WARN_LEVELS: ReadonlySet<unknown> = new Set<unknown>([
  1,
  '1',
  'warn',
  'warning',
]);
const ERROR_LEVELS: ReadonlySet<unknown> = new Set<unknown>([2, '2', 'error']);

export function parseLevel(value: unknown): Level | undefined {
  if (Array.isArray(value)) {
    // One level in a list, as ESLint writes `["error"]`; a list in a list is not one.
    return value.length === 1 && !Array.isArray(value[0])
      ? parseLevel(value[0])
      : undefined;
  }
  if (value === true || value === 'on') {
    return 'on';
  }
  if (OFF_LEVELS.has(value)) {
    return 'off';
  }
  if (WARN_LEVELS.has(value)) {
    return 'warn';
  }
  if (ERROR_LEVELS.has(value)) {
    return 'error';
  }
  return undefined;
}

/** Levels set in order (a later one wins), and the mistakes found while reading them. */
interface Step {
  readonly entries: readonly (readonly [string, Level])[];
  readonly problems: readonly string[];
}

/** The rules a deployment is checked with, and what to tell the people who wrote the configuration. */
export interface ResolvedRules {
  /** The level of every rule that is not off, by rule id. */
  readonly levels: ReadonlyMap<string, Level>;
  /** Which findings open an issue. */
  readonly issues: IssueLevel;
  /** Whether to send a `repository_dispatch` event after each run. */
  readonly dispatch: boolean;
  /** Whether checks are on; false when the file says `enabled: false`. */
  readonly enabled: boolean;
  /** The hosts the file declares as sites. */
  readonly sites: readonly string[];
  /** The environment-name patterns whose deployments are sites; null for every non-preview environment. */
  readonly siteEnvironments: readonly string[] | null;
  /** Which site a preview is compared with, as environment-name patterns and hosts. */
  readonly previews: readonly (readonly [string, string])[];
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
  const extendWith = (named: string, where: string): Step => {
    const [name = named, pin] = named.split('@');
    const set = Object.hasOwn(RULE_SETS, name) ? RULE_SETS[name] : undefined;
    if (!set) {
      return {
        entries: [],
        problems: [`Unknown rule set "${name}" in ${where}.`],
      };
    }
    const version = pin === undefined ? undefined : Number(pin);
    if (version !== undefined && !Number.isInteger(version)) {
      return {
        entries: [],
        problems: [
          `Rule set "${named}" in ${where} has a version that is not a whole number.`,
        ],
      };
    }
    return {
      // A pinned set drops the checks added to the catalogue after the pin.
      entries: Object.entries(set).filter(
        ([id]) =>
          version === undefined || (findCheck(id)?.since ?? 0) <= version,
      ),
      problems: [],
    };
  };
  const apply = (overlay: Overlay, where: string): Step => {
    // Groups first, then single checks, so a check always beats its group.
    const entries = Object.entries(overlay.rules);
    const groups = entries.filter(([id]) => !isCheckId(id));
    const checks = entries.filter(([id]) => isCheckId(id));
    const steps = [
      ...(overlay.extends ?? []).map((named) => extendWith(named, where)),
      ...[groups, checks].flat().map(([id, value]): Step => {
        const level = parseLevel(value);
        if (level === undefined) {
          return {
            entries: [],
            problems: [
              `Rule "${id}" in ${where} is set to ${JSON.stringify(value)}; use off, warn, error or on.`,
            ],
          };
        }
        if (isCheckId(id)) {
          return { entries: [[id, level]], problems: [] };
        }
        if (id.includes(':') && isGroup(id)) {
          return {
            entries: checksInGroup(id).map(
              (check) => [check.id, level] as const,
            ),
            problems: [],
          };
        }
        return { entries: [], problems: [`Unknown rule "${id}" in ${where}.`] };
      }),
    ];
    return {
      entries: steps.flatMap((step) => step.entries),
      problems: steps.flatMap((step) => step.problems),
    };
  };
  const path = loaded?.path ?? 'the configuration';
  const overlay = loaded?.environments[environment];
  const applied = [
    apply(
      {
        extends: loaded?.extends ?? [DEFAULT_RULE_SET],
        rules: loaded?.rules ?? {},
      },
      path,
    ),
    ...(overlay
      ? [apply(overlay, `the ${environment} environment of ${path}`)]
      : []),
  ];
  const problems = [
    ...(loaded?.problems ?? []),
    ...applied.flatMap((step) => step.problems),
  ];
  const levels = new Map(
    [...new Map(applied.flatMap((step) => step.entries))].filter(
      ([, level]) => level !== 'off',
    ),
  );
  return {
    levels,
    issues: loaded?.issues ?? 'error',
    dispatch: loaded?.dispatch ?? false,
    enabled: loaded?.enabled ?? true,
    sites: loaded?.sites ?? [],
    siteEnvironments: loaded?.siteEnvironments ?? null,
    previews: loaded?.previews ?? [],
    problems,
    source: loaded?.path ?? null,
  };
}
