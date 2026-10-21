/**
 * The webhint formatter `@mridang/webhint-formatter-extra`. It writes one
 * self-contained HTML report that groups hints into the sections stamped on
 * their metadata, shows descriptions, references and origins, and filters by
 * source group.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FormatterOptions, IFormatter } from 'hint';
import type { Problem } from '@hint/utils-types';
import { generateReport } from './render.js';
import type { Finding, HintInfo, Origin } from './sections.js';

/** The extra fields our hints stamp on `meta.docs`; webhint does not type them. */
interface Extras {
  groups?: unknown;
  url?: unknown;
  section?: unknown;
  sectionTitle?: unknown;
  sectionDescription?: unknown;
  sectionOrder?: unknown;
  tags?: unknown;
  origins?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const texts = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

/** Reads the origins, ignoring entries that are not objects of strings. */
function originsOf(value: unknown): Origin[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter(
      (o): o is Record<string, unknown> => typeof o === 'object' && o !== null,
    )
    .map((o) => ({
      source: text(o.source) ?? '',
      upstreamId: text(o.upstreamId) ?? '',
      title: text(o.title) ?? '',
      url: text(o.url) ?? '',
      docsUrl: text(o.docsUrl) ?? '',
      summary: text(o.summary) ?? '',
      licence: text(o.licence) ?? '',
    }));
}

/**
 * Names the report file after the target, like the stock html formatter.
 *
 * @param target The scanned URL.
 * @returns A file name without directory, ending in `.html`.
 */
function fileName(target: string): string {
  const name = target
    .replace(/:\/\//g, '-')
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/[?=]/g, '-query-')
    .replace(/-$/, '');
  return `${name || 'report'}.html`;
}

/** Webhint formatter that writes `hint-report/<site>.html`. */
export default class ExtraFormatter implements IFormatter {
  /**
   * Writes the report and logs where it is.
   *
   * @param problems All findings of the scan.
   * @param options Webhint's formatter options.
   */
  public async format(
    problems: Problem[],
    options: FormatterOptions = {},
  ): Promise<void> {
    const target = options.target ?? '';
    const hints: HintInfo[] = (options.resources?.hints ?? []).map((ctor) => {
      const extras = (ctor.meta.docs ?? {}) as Extras;
      return {
        id: ctor.meta.id,
        name: ctor.meta.docs?.name ?? ctor.meta.id,
        description: ctor.meta.docs?.description ?? '',
        category: String(ctor.meta.docs?.category ?? 'other'),
        groups: texts(extras.groups),
        url: text(extras.url),
        section: text(extras.section),
        sectionTitle: text(extras.sectionTitle),
        sectionDescription: text(extras.sectionDescription),
        sectionOrder:
          typeof extras.sectionOrder === 'number'
            ? extras.sectionOrder
            : undefined,
        tags: texts(extras.tags),
        origins: originsOf(extras.origins),
      };
    });
    const findings: Finding[] = problems.map((p) => ({
      hintId: p.hintId,
      severity: p.severity,
      message: p.message,
      resource: p.resource,
      location: p.location,
      sourceCode: p.sourceCode,
      codeLanguage: p.codeLanguage,
      documentation: p.documentation,
    }));
    const html = generateReport({
      target,
      date: options.date ?? new Date().toISOString(),
      hints,
      findings,
    });
    const directory = options.output ?? path.join(process.cwd(), 'hint-report');
    const destination = path.join(directory, fileName(target));
    await mkdir(directory, { recursive: true });
    await writeFile(destination, html, 'utf8');
    console.log(`You can view the HTML report in "${destination}"`);
  }
}
