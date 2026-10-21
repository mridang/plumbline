/**
 * Groups a hint can belong to. A hint lists every group it is part of, so a
 * preset can switch on a whole source (for example `owasp`) or a whole topic
 * (for example `tls`) and one hint can appear in several presets.
 */

/**
 * The source each check was taken from. Keeping the original grouping lets
 * the checks of one reference be enabled or disabled together.
 */
export const SOURCE_GROUPS = [
  'observatory',
  'owasp',
  'opengraph',
  'agent-ready',
  'webbkoll',
  'internetnl',
  'files',
  'llmscout',
  'original',
] as const;

/** What a check is about, regardless of where it came from. */
const TOPIC_GROUPS = [
  'security-headers',
  'tls',
  'dns',
  'privacy',
  'seo',
  'social',
  'email',
  'agent',
] as const;

export const GROUPS = [...SOURCE_GROUPS, ...TOPIC_GROUPS] as const;

export type Group = (typeof GROUPS)[number];
