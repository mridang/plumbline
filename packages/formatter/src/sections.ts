/**
 * Groups hints and their findings into the report's sections. A hint lands
 * in the section stamped on its metadata (`meta.docs.section`); hints without
 * one, such as stock webhint hints, fall back to a section named after their
 * webhint category.
 */

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
  /** Ids of other sections the hint also touches. */
  tags?: readonly string[];
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
  /** Source groups the hint came from and the other sections it touches. */
  badges: string[];
}

/** One sidebar section. */
export interface Section {
  /** Stable key, usable as an HTML id fragment. */
  key: string;
  title: string;
  /** One line saying what the section holds, when known. */
  description?: string;
  hints: HintBlock[];
  counts: Counts;
  /** True when no hint in the section has a finding. */
  passed: boolean;
}

/**
 * Chooses the section of a hint.
 *
 * @param info The hint's metadata.
 * @returns The section key and title.
 */
export function sectionFor(info: HintInfo): { key: string; title: string } {
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
 *
 * @param value Kebab or plain text.
 * @returns Words separated by spaces, first letters upper-cased.
 */
function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Counts findings by severity.
 *
 * @param findings Findings to count.
 * @returns Totals; information is folded into `hint`.
 */
export function countFindings(findings: readonly Finding[]): Counts {
  const counts: Counts = { error: 0, warning: 0, hint: 0 };
  for (const finding of findings) {
    if (finding.severity >= SEVERITY.error) {
      counts.error++;
    } else if (finding.severity === SEVERITY.warning) {
      counts.warning++;
    } else {
      counts.hint++;
    }
  }
  return counts;
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
 *
 * @param hints Every hint that ran.
 * @param findings Every finding of the scan.
 * @returns The sections, in display order.
 */
export function buildSections(
  hints: readonly HintInfo[],
  findings: readonly Finding[],
): Section[] {
  const infos = new Map<string, HintInfo>();
  for (const hint of hints) {
    infos.set(hint.id, hint);
  }
  for (const finding of findings) {
    if (!infos.has(finding.hintId)) {
      infos.set(finding.hintId, {
        id: finding.hintId,
        name: finding.hintId,
        description: '',
        category: 'other',
        groups: [],
      });
    }
  }

  // Titles of stamped sections, so a tag (a section id) can show its title.
  const titles = new Map<string, string>();
  for (const info of infos.values()) {
    if (info.section && info.sectionTitle) {
      titles.set(info.section, info.sectionTitle);
    }
  }

  const sections = new Map<string, Section>();
  const order = new Map<string, number>();
  for (const info of infos.values()) {
    const { key, title } = sectionFor(info);
    const own = findings.filter((f) => f.hintId === info.id);
    const block: HintBlock = {
      info,
      findings: own,
      counts: countFindings(own),
      badges: [
        ...info.groups.filter((g) =>
          (SOURCE_GROUPS as readonly string[]).includes(g),
        ),
        ...(info.tags ?? []).map((tag) => titles.get(tag) ?? tag),
      ],
    };
    const section = sections.get(key) ?? {
      key,
      title,
      description: info.sectionDescription,
      hints: [],
      counts: { error: 0, warning: 0, hint: 0 },
      passed: true,
    };
    section.hints.push(block);
    section.counts = add(section.counts, block.counts);
    section.passed = section.passed && own.length === 0;
    sections.set(key, section);
    if (info.sectionOrder !== undefined) {
      order.set(key, info.sectionOrder);
    }
  }

  const rank = (key: string): number => order.get(key) ?? order.size + 1;
  const result = [...sections.values()].sort(
    (a, b) => rank(a.key) - rank(b.key) || a.title.localeCompare(b.title),
  );
  for (const section of result) {
    section.hints.sort(
      (a, b) =>
        weight(b.counts) - weight(a.counts) ||
        a.info.name.localeCompare(b.info.name),
    );
  }
  return result;
}
