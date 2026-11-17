/**
 * Writes the catalogue of checks the server can talk about (the REST API, the
 * MCP server and the check-configuration form) as a TypeScript module.
 *
 * The checks themselves run in the visitor's browser, and only there: their
 * code is far too big for the Worker, which on the Free plan has 3 MB for the
 * whole bundle and 10 ms of CPU a request. So the Worker never imports the
 * hints package, apart from the few pure rule files the server-side page
 * checks use (`src/domain/suite/checks.ts`). Instead this script loads it
 * once, in Node, and keeps what a hint says about itself (its id, name,
 * description, groups, report section,
 * reference and where it came from) and who usually makes its fix, which is all
 * the server needs.
 *
 * Run via `devbox run -- npm run build:catalogue` (invoked before the Next
 * build, the tests, the type check and the linter). It reads the built hints
 * package, so `npm run build` at the root must have run first.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import extraHints from '@mridang/webhint-hint-plumbline';
import { ALIASES } from '@mridang/webhint-hint-plumbline/dist/core/groups.js';
import {
  CONTROLS,
  GROUP_DEFS,
  HOW_TO_FIX,
  INTRO,
  OPT_IN_NOTE,
  PLACEMENT,
  PROFILES,
  SECTIONS,
  SECTION_DEFS,
  SET_DEFS,
  TAG_IDS,
} from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(root, 'dist');

/** A string field of `documentation`, or the fallback. */
function text(documentation, key, fallback) {
  return typeof documentation[key] === 'string' ? documentation[key] : fallback;
}

/** Who usually makes the fix for a check in each report section. */
const FIXERS = new Map(SECTIONS.map((s) => [s.id, s.fixer]));

/** The upstream checks a hint came from, in the API's own spelling. */
function originsOf(documentation) {
  return (
    Array.isArray(documentation.origins) ? documentation.origins : []
  ).map((origin) => ({
    source: origin.source,
    title: origin.title || origin.upstreamId,
    url: origin.url,
    // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
    ...(origin.docsUrl ? { docs_url: origin.docsUrl } : {}),
    summary: origin.summary,
  }));
}

const checks = Object.keys(extraHints)
  .toSorted((a, b) => Number(a > b) - Number(a < b))
  .map((id) => {
    const documentation = extraHints[id]?.meta?.docs ?? {};
    const fixer = FIXERS.get(documentation.section);
    return {
      id,
      name: text(documentation, 'name', id),
      description: text(documentation, 'description', ''),
      groups: Array.isArray(documentation.groups)
        ? [...documentation.groups]
        : [],
      section: text(documentation, 'section', 'other'),
      // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
      section_title: text(documentation, 'sectionTitle', 'Other'),
      // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
      section_order:
        typeof documentation.sectionOrder === 'number'
          ? documentation.sectionOrder
          : Number.MAX_SAFE_INTEGER,
      group: text(documentation, 'group', 'other'),
      subsection: text(documentation, 'subsection', ''),
      ...(PLACEMENT[id]?.note ? { note: PLACEMENT[id].note } : {}),
      tags: Array.isArray(documentation.tags) ? [...documentation.tags] : [],
      tier: text(documentation, 'tier', 'advanced'),
      target: text(documentation, 'target', 'web'),
      control: text(documentation, 'control', 'deployer'),
      since: typeof documentation.since === 'number' ? documentation.since : 1,
      added: text(documentation, 'added', ''),
      // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
      ...(HOW_TO_FIX[id] ? { how_to_fix: HOW_TO_FIX[id] } : {}),
      ...(typeof documentation.url === 'string'
        ? { reference: documentation.url }
        : {}),
      ...(fixer ? { fixer } : {}),
      origins: originsOf(documentation),
    };
  });

/** The report sections in their order, each with what it holds and who fixes it. */
const sections = SECTIONS.map((section) => ({
  id: section.id,
  title: section.title,
  description: section.description,
  fixer: section.fixer,
  intro: section.intro,
  order: section.order,
  group: section.group,
  // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
  group_title: section.groupTitle,
  // eslint-disable-next-line camelcase -- the catalogue keeps the snake_case spelling of the API
  default_on:
    SECTION_DEFS.find((definition) => definition.id === section.id)
      ?.defaultOn !== false,
}));

/** The display groups, in order. */
const displayGroups = GROUP_DEFS.map((group) => ({
  id: group.id,
  title: group.title,
  sections: [...group.sections],
}));

/** The hand-listed sets, the tags and the old names that still resolve. */
const profiles = PROFILES.map((profile) => ({ ...profile }));

await mkdir(outDir, { recursive: true });
await writeFile(
  path.resolve(outDir, 'catalogue.ts'),
  `// AUTO-GENERATED by scripts/build-catalogue.mjs — do not edit by hand.\n` +
    `export const checks = ${JSON.stringify(checks)};\n` +
    `export const sections = ${JSON.stringify(sections)};\n` +
    `export const displayGroups = ${JSON.stringify(displayGroups)};\n` +
    `export const profiles = ${JSON.stringify(profiles)};\n` +
    `export const tags = ${JSON.stringify(TAG_IDS)};\n` +
    `export const controls = ${JSON.stringify(CONTROLS)};\n` +
    `export const setDefs = ${JSON.stringify(SET_DEFS)};\n` +
    `export const intro = ${JSON.stringify(INTRO)};\n` +
    `export const optInNote = ${JSON.stringify(OPT_IN_NOTE)};\n` +
    `export const aliases = ${JSON.stringify(ALIASES)};\n`,
);
console.log(`built catalogue → ${checks.length} checks`);
