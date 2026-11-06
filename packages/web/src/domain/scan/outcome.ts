/**
 * @packageDocumentation
 *
 * What a scan hands the page: the description of each hint and what became of
 * it. The server-side scanner (the CLI's engine, run in the scanner container)
 * produces these and streams them as JSON lines; the page only reads them.
 */

/** An upstream check a hint was taken from. */
export interface HintOrigin {
  readonly source: string;
  readonly title: string;
  readonly url: string;
  readonly docsUrl?: string;
  readonly summary: string;
}

/** What the page shows about one hint. */
export interface HintInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The rule's source, when the hint links one. */
  readonly reference?: string;
  /** The report section the hint is sorted into, and its order on the page. */
  readonly section: string;
  readonly sectionTitle: string;
  readonly sectionOrder: number;
  /** The sources and topics the hint belongs to. */
  readonly groups: readonly string[];
  /** The display group of the section, and the hint's place in the taxonomy. */
  readonly group?: string;
  readonly subsection?: string;
  readonly tags?: readonly string[];
  readonly tier?: 'recommended' | 'advanced' | 'experimental';
  readonly target?: 'web' | 'mail' | 'site';
  readonly control?: 'deployer' | 'platform' | 'dns' | 'mail';
  /** The month the hint was added, `YYYY-MM`. */
  readonly added?: string;
  /** Who usually makes the fix, from the hint's section. */
  readonly fixer?: string;
  /** The upstream checks it was taken from; empty for one written here. */
  readonly origins: readonly HintOrigin[];
}

/** How serious a finding is, in the words the page uses. */
type FindingLevel = 'error' | 'warning' | 'hint' | 'information';

/** A page a finding points to for more on the problem or its fix. */
export interface FindingLink {
  readonly url: string;
  readonly text: string;
}

/** One thing a hint reported. */
export interface Finding {
  readonly resource: string;
  readonly message: string;
  readonly level: FindingLevel;
  /** The evidence: the header, the markup or the record at fault. */
  readonly snippet?: string;
  /** What the snippet is written in (`http`, `html`, …). */
  readonly language?: string;
  /** Where in the resource, when the hint knows. */
  readonly line?: number;
  readonly column?: number;
  /** Further reading the hint gave for this finding, besides its own reference. */
  readonly links?: readonly FindingLink[];
}

/** What became of one hint. */
export type HintStatus = 'failed' | 'warned' | 'passed' | 'skipped';

/** One hint's outcome. */
export interface HintOutcome extends HintInfo {
  readonly status: HintStatus;
  /** Why a skipped hint did not run. */
  readonly reason?: string;
  readonly findings: readonly Finding[];
}
