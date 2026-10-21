/**
 * The webhint formatter `@mridang/webhint-formatter-extra`. It writes one
 * self-contained HTML report that groups hints by topic, shows hint
 * descriptions and references, and filters by source group.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FormatterOptions, IFormatter } from 'hint';
import type { Problem } from '@hint/utils-types';
import { generateReport } from './render.js';
import type { Finding, HintInfo } from './sections.js';

/** Reads `meta.docs.groups`, which webhint's own types do not declare. */
function groupsOf(docs: unknown): string[] {
  const groups = (docs as { groups?: unknown } | undefined)?.groups;
  return Array.isArray(groups)
    ? groups.filter((g): g is string => typeof g === 'string')
    : [];
}

/** Reads `meta.docs.url`, which webhint's own types do not declare. */
function urlOf(docs: unknown): string | undefined {
  const url = (docs as { url?: unknown } | undefined)?.url;
  return typeof url === 'string' ? url : undefined;
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
      const docs: unknown = ctor.meta.docs;
      return {
        id: ctor.meta.id,
        name: ctor.meta.docs?.name ?? ctor.meta.id,
        description: ctor.meta.docs?.description ?? '',
        category: String(ctor.meta.docs?.category ?? 'other'),
        groups: groupsOf(docs),
        url: urlOf(docs),
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
