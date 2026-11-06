/**
 * Groups a hint can belong to. A hint lists every group it is part of, so a
 * preset can switch on a whole source (for example `owasp`) or a whole topic
 * (for example `tls`) and one hint can appear in several presets.
 *
 * The taxonomy (`taxonomy.ts`) has since replaced the topic groups with
 * sections, tags, targets and tiers. The old topic groups and the old section
 * ids stay as names people already use, through {@link ALIASES}.
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
  'mdn',
  'original',
  'w3c',
  'iab',
  'indieweb',
  'apple',
  'google',
  'ietf',
  'oembed',
  'opensearch',
  'roctify',
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
  'pwa',
] as const;

export const GROUPS = [...SOURCE_GROUPS, ...TOPIC_GROUPS] as const;

export type Group = (typeof GROUPS)[number];

/**
 * Old names that now stand for a selector of the taxonomy: the topic groups
 * that have no section, tag or target of the same name (`tls` is the tag of
 * that name), and the ids of the
 * eight sections the first taxonomy used. A name stands for the union of its
 * selectors. Membership is approximate, because the new sections regroup the
 * checks; the source groups and the names that are also a section or a tag
 * (`dns`, `email`, `privacy`, `seo`, `pwa`) need no entry.
 */
export const ALIASES: Readonly<Record<string, readonly string[]>> = {
  'security-headers': [
    'section:https',
    'section:hardening',
    'section:exposure',
    'section:protocol',
  ],
  social: ['tag:sharing'],
  agent: ['tag:ai'],
  'llms-ai': ['tag:ai'],
  search: ['section:seo', 'section:performance'],
  'social-previews': ['section:sharing', 'section:feeds', 'section:pwa'],
  'https-tls': ['section:https'],
  'site-protection': [
    'section:hardening',
    'section:exposure',
    'section:protocol',
  ],
  'visitor-privacy': ['section:privacy'],
  'dns-network': ['section:dns'],
};
