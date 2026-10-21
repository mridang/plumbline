/**
 * Groups hints and their findings into the report's sections. A hint lands
 * in the section of the first topic group (by a fixed precedence) found in
 * its `meta.docs.groups`; hints without a topic group fall back to a section
 * named after their webhint category.
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
] as const;

/** Topic groups in section precedence order, with their display titles. */
const TOPICS: readonly (readonly [string, string])[] = [
  ['agent', 'Agent readiness'],
  ['email', 'Email'],
  ['dns', 'DNS'],
  ['tls', 'TLS and certificates'],
  ['privacy', 'Privacy'],
  ['security-headers', 'Security headers'],
  ['social', 'Social previews'],
  ['seo', 'SEO'],
];

/** What the report needs to know about a hint that ran. */
export interface HintInfo {
  /** Full hint id, for example `extra/csp`. */
  id: string;
  name: string;
  description: string;
  /** Webhint category, used when the hint has no topic group. */
  category: string;
  groups: readonly string[];
  /** The `meta.docs.url` reference link, when the hint has one. */
  url?: string;
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
  /** The hint's groups other than the one that chose its section. */
  badges: string[];
}

/** One sidebar section. */
export interface Section {
  /** Stable key, usable as an HTML id fragment. */
  key: string;
  title: string;
  hints: HintBlock[];
  counts: Counts;
  /** True when no hint in the section has a finding. */
  passed: boolean;
}

/**
 * Chooses the section of a hint.
 *
 * @param info The hint's metadata.
 * @returns The section key, its title and the topic group used (if any).
 */
export function sectionFor(info: HintInfo): {
  key: string;
  title: string;
  topic?: string;
} {
  const topic = TOPICS.find(([name]) => info.groups.includes(name));
  if (topic) {
    return { key: topic[0], title: topic[1], topic: topic[0] };
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
 * with metadata derived from the finding. Topic sections come first in
 * precedence order, then category sections alphabetically. Inside a section
 * hints with the most severe findings come first, passed hints last.
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

  const sections = new Map<string, Section>();
  for (const info of infos.values()) {
    const { key, title, topic } = sectionFor(info);
    const own = findings.filter((f) => f.hintId === info.id);
    const block: HintBlock = {
      info,
      findings: own,
      counts: countFindings(own),
      badges: info.groups.filter((group) => group !== topic),
    };
    const section = sections.get(key) ?? {
      key,
      title,
      hints: [],
      counts: { error: 0, warning: 0, hint: 0 },
      passed: true,
    };
    section.hints.push(block);
    section.counts = add(section.counts, block.counts);
    section.passed = section.passed && own.length === 0;
    sections.set(key, section);
  }

  const order = TOPICS.map(([name]) => name);
  const rank = (key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
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
