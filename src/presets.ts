import { GROUPS, type Group } from './core/groups.js';

/** The name webhint knows this package by, used as the prefix of hint ids. */
export const PACKAGE_NAME = '@mridang/webhint-hint-extra';

/**
 * A webhint configuration that switches on every hint of one group. Webhint
 * validates an extended file as a whole configuration, so a preset names a
 * connector and the parser its hints read; a project's own `.hintrc`
 * overrides either.
 */
export interface Preset {
  connector: { name: string };
  parsers: string[];
  hints: Record<string, 'default'>;
}

/**
 * Builds one preset per group. Hints are set to `default` so each keeps the
 * severity its rule defines (an error, a warning or a hint) instead of being
 * forced to a single level.
 */
export function buildPresets(
  byGroup: Record<Group, readonly string[]>,
): Record<Group, Preset> {
  return Object.fromEntries(
    GROUPS.map((group) => [
      group,
      {
        connector: { name: 'puppeteer' },
        parsers: ['html'],
        hints: Object.fromEntries(
          [...byGroup[group]]
            .sort()
            .map((id) => [`${PACKAGE_NAME}/${id}`, 'default']),
        ),
      },
    ]),
  ) as Record<Group, Preset>;
}
