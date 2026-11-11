import { describe, expect, it } from '@jest/globals';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from '../src/core/groups.js';
import {
  buildPresets,
  buildTaxonomyPresets,
  PACKAGE_NAME,
} from '../src/presets.js';
import { PLACEMENT, SECTION_DEFS } from '../src/core/taxonomy-data.js';
import registry, { hintsByGroup } from '../src/index.js';

const CONFIGS = fileURLToPath(new URL('../configs', import.meta.url));

/** Returns an alphabetically sorted copy of the strings. */
const sorted = (values: readonly string[]): string[] =>
  values.toSorted((a, b) => a.localeCompare(b));

describe('buildPresets', () => {
  const presets = buildPresets(hintsByGroup);

  it('creates a preset for every group', () => {
    expect(sorted(Object.keys(presets))).toEqual(sorted([...GROUPS]));
  });

  it('names hints by their package id and keeps their own severity', () => {
    const [first] = Object.entries(presets.owasp.hints);
    expect(first[0].startsWith(`${PACKAGE_NAME}/`)).toBe(true);
    expect(first[1]).toBe('default');
  });

  it('is a valid webhint configuration on its own', () => {
    expect(presets.owasp.connector).toEqual({ name: 'puppeteer' });
    expect(presets.owasp.parsers).toEqual(['html']);
  });

  it('lists the hints of a group sorted', () => {
    const ids = Object.keys(presets.owasp.hints);
    expect(ids).toEqual(sorted(ids));
  });

  it('only lists hints that belong to the group', () => {
    for (const group of GROUPS) {
      const expected = hintsByGroup[group].map((id) => `${PACKAGE_NAME}/${id}`);
      expect(sorted(Object.keys(presets[group].hints))).toEqual(
        sorted(expected),
      );
    }
  });
});

describe('configs/*.json', () => {
  it('matches the registry (run with UPDATE_CONFIGS=1 to rewrite)', async () => {
    const presets = buildPresets(hintsByGroup);
    for (const group of GROUPS) {
      const file = path.join(CONFIGS, `${group}.json`);
      const wanted = `${JSON.stringify(presets[group], null, 2)}\n`;
      if (process.env.UPDATE_CONFIGS === '1') {
        await mkdir(CONFIGS, { recursive: true });
        await writeFile(file, wanted);
      }
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(presets[group]);
    }
  });
});

describe('buildTaxonomyPresets', () => {
  const ids = Object.keys(registry);
  const presets = buildTaxonomyPresets(ids);
  const names = (name: string) =>
    Object.keys(presets[name]!.hints).map((id) =>
      id.slice(PACKAGE_NAME.length + 1),
    );

  it('makes the tier presets from the tiers of the placements', () => {
    expect(sorted(names('plumbline-recommended'))).toEqual(
      sorted(
        ids.filter(
          (id) =>
            PLACEMENT[id]!.tier === 'recommended' &&
            SECTION_DEFS.find((s) => s.id === PLACEMENT[id]!.section)
              ?.defaultOn !== false,
        ),
      ),
    );
    expect(sorted(names('plumbline-experimental'))).toEqual(
      sorted(ids.filter((id) => PLACEMENT[id]!.tier === 'experimental')),
    );
    expect(names('plumbline-all')).toHaveLength(ids.length);
  });

  it('holds the recommended checks in the advanced preset too', () => {
    const advanced = new Set(names('plumbline-advanced'));
    expect(names('plumbline-recommended').every((id) => advanced.has(id))).toBe(
      true,
    );
  });

  it('keeps an opt-in section out of the recommended preset', () => {
    const optIn = SECTION_DEFS.find((s) => s.defaultOn === false)!;
    const inSection = names(`section-${optIn.id}-recommended`);
    expect(inSection.length).toBeGreaterThan(0);
    expect(names('plumbline-recommended')).not.toContain(inSection[0]);
  });

  it('leaves out checks the registry does not know', () => {
    expect(
      Object.keys(buildTaxonomyPresets(['csp'])['plumbline-all']!.hints),
    ).toEqual([`${PACKAGE_NAME}/csp`]);
  });
});

describe('configs/*.json of the taxonomy', () => {
  it('matches the registry (run with UPDATE_CONFIGS=1 to rewrite)', async () => {
    const presets = buildTaxonomyPresets(Object.keys(registry));
    for (const [name, preset] of Object.entries(presets)) {
      const file = path.join(CONFIGS, `${name}.json`);
      if (process.env.UPDATE_CONFIGS === '1') {
        await writeFile(file, `${JSON.stringify(preset, null, 2)}\n`);
      }
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(preset);
    }
  });
});
