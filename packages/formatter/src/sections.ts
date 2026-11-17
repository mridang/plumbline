/**
 * Groups hints and their findings into the report's sections. A hint lands
 * in the section stamped on its metadata (`meta.docs.section`); hints without
 * one, such as stock webhint hints, fall back to a section named after their
 * webhint category.
 */

/** Locale-aware comparator used to order sections and hints by name. */
const collator = new Intl.Collator();

/** Matches a run of dashes, underscores or whitespace between words. */
const SEPARATORS = /[-_\s]+/u;

/** Numeric severities, mirroring webhint's `Severity` enum. */
export const SEVERITY = {
  information: 1,
  hint: 2,
  warning: 3,
  error: 4,
} as const;

/** The groups that name where a check came from; used by the filter. */
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

/** What the report needs to know about a hint that ran. */
export interface HintInfo {
  /** Full hint id, for example `extra/csp`. */
  id: string;
  name: string;
  description: string;
  /** Webhint category, used when the hint has no section of its own. */
  category: string;
  groups: readonly string[];
  /** The `meta.docs.url` reference link, when the hint has one. */
  url?: string;
  /** Section id, title, one-line description and position, when stamped. */
  section?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  sectionOrder?: number;
  /** The display group of the section, by id and title. */
  group?: string;
  groupTitle?: string;
  /** Free-text subsection inside the section, for example `cors`. */
  subsection?: string;
  /** Goal and audience tags, for example `seo` or `store`. */
  tags?: readonly string[];
  /** `recommended`, `advanced` or `experimental`. */
  tier?: string;
  /** `web`, `mail` or `site`. */
  target?: string;
  /** Who can fix a finding: `deployer`, `platform`, `dns` or `mail`. */
  control?: string;
  /** The month the check was added, `YYYY-MM`. */
  added?: string;
  /** Where the hint came from; absent for hints that do not record it. */
  origins?: readonly Origin[];
}

/** One upstream check a hint was ported from. */
export interface Origin {
  source: string;
  upstreamId: string;
  title: string;
  url: string;
  docsUrl: string;
  summary: string;
  licence: string;
}

/** One finding, reduced to the fields the report shows. */
export interface Finding {
  hintId: string;
  severity: number;
  message: string;
  resource: string;
  location?: { line: number; column: number };
  sourceCode?: string;
  codeLanguage?: string;
  documentation?: readonly { link: string; text: string }[];
}

/** Finding counts by severity; information counts as a hint. */
export interface Counts {
  error: number;
  warning: number;
  hint: number;
}

/** A hint together with its findings, ready to render. */
export interface HintBlock {
  info: HintInfo;
  findings: Finding[];
  counts: Counts;
  /** The tier (unless recommended), the sources the hint came from and its tags. */
  badges: string[];
}

/** One sidebar section. */
export interface Section {
  /** Stable key, usable as an HTML id fragment. */
  key: string;
  title: string;
  /** One line saying what the section holds, when known. */
  description?: string;
  /** The display group the section is shown under. */
  group?: string;
  groupTitle?: string;
  hints: HintBlock[];
  counts: Counts;
  /** True when no hint in the section has a finding. */
  passed: boolean;
}

/**
 * Chooses the section of a hint.
 * @param info - The hint's metadata.
 * @returns The section key and title.
 */
export function sectionFor(info: HintInfo): Pick<Section, 'key' | 'title'> {
  if (info.section) {
    return {
      key: info.section,
      title: info.sectionTitle || titleCase(info.section),
    };
  }
  const category = info.category || 'other';
  return { key: `category-${category}`, title: titleCase(category) };
}

/**
 * Title-cases a category such as `best-practices`.
 * @param value - Kebab or plain text.
 * @returns Words separated by spaces, first letters upper-cased.
 */
function titleCase(value: string): string {
  return value
    .split(SEPARATORS)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Counts findings by severity.
 * @param findings - Findings to count.
 * @returns Totals; information is folded into `hint`.
 */
export function countFindings(findings: readonly Finding[]): Counts {
  const error = findings.filter((f) => f.severity >= SEVERITY.error).length;
  const warning = findings.filter(
    (f) => f.severity < SEVERITY.error && f.severity === SEVERITY.warning,
  ).length;
  return { error, warning, hint: findings.length - error - warning };
}

/** Sums two count sets. */
function add(a: Counts, b: Counts): Counts {
  return {
    error: a.error + b.error,
    warning: a.warning + b.warning,
    hint: a.hint + b.hint,
  };
}

/** Sort weight of a block: errors first, then warnings, hints, passed. */
function weight(counts: Counts): number {
  return counts.error * 1e6 + counts.warning * 1e3 + counts.hint;
}

/**
 * Builds the sections of the report.
 *
 * Hints that produced findings but are missing from `hints` are still shown,
 * with metadata derived from the finding. Sections that hints were stamped
 * with come first in their stamped order, then category sections for other
 * hints alphabetically. Inside a section hints with the most severe findings
 * come first, passed hints last.
 * @param hints - Every hint that ran.
 * @param findings - Every finding of the scan.
 * @returns The sections, in display order.
 */
export function buildSections(
  hints: readonly HintInfo[],
  findings: readonly Finding[],
): Section[] {
  const known = new Set(hints.map((hint) => hint.id));
  const infos = new Map<string, HintInfo>(
    [
      hints.map((hint): [string, HintInfo] => [hint.id, hint]),
      findings.flatMap((finding): [string, HintInfo][] =>
        known.has(finding.hintId)
          ? []
          : [
              [
                finding.hintId,
                {
                  id: finding.hintId,
                  name: finding.hintId,
                  description: '',
                  category: 'other',
                  groups: [],
                },
              ],
            ],
      ),
    ].flat(),
  );

  // Titles of stamped sections, so a tag that is also a section id shows its title.
  const titles = new Map(
    [...infos.values()].flatMap((info) =>
      info.section && info.sectionTitle
        ? [[info.section, info.sectionTitle] as const]
        : [],
    ),
  );

  const entries = Array.from(infos.values(), (info) => {
    const { key, title } = sectionFor(info);
    const own = findings.filter((f) => f.hintId === info.id);
    const block: HintBlock = {
      info,
      findings: own,
      counts: countFindings(own),
      badges: [
        ...(info.tier && info.tier !== 'recommended' ? [info.tier] : []),
        ...info.groups.filter((g) =>
          (SOURCE_GROUPS as readonly string[]).includes(g),
        ),
        ...(info.tags ?? []).map((tag) => titles.get(tag) ?? tag),
      ],
    };
    return { info, key, title, own, block };
  });
  const sections = Array.from(
    Map.groupBy(entries, (entry) => entry.key),
    ([key, group]): Section => ({
      key,
      title: group[0]?.title ?? key,
      description: group[0]?.info.sectionDescription,
      group: group[0]?.info.group,
      groupTitle: group[0]?.info.groupTitle,
      hints: group.map((entry) => entry.block),
      counts: group.reduce((sum, entry) => add(sum, entry.block.counts), {
        error: 0,
        warning: 0,
        hint: 0,
      }),
      passed: group.every((entry) => entry.own.length === 0),
    }),
  );
  const order = new Map(
    entries.flatMap(({ info, key }) =>
      info.sectionOrder === undefined
        ? []
        : [[key, info.sectionOrder] as const],
    ),
  );

  const rank = (key: string): number => order.get(key) ?? order.size + 1;
  return sections
    .toSorted(
      (a, b) => rank(a.key) - rank(b.key) || collator.compare(a.title, b.title),
    )
    .map((section) => ({
      ...section,
      hints: section.hints.toSorted(
        (a, b) =>
          weight(b.counts) - weight(a.counts) ||
          collator.compare(a.info.name, b.info.name),
      ),
    }));
}
