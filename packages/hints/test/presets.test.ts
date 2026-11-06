import { describe, expect, it } from '@jest/globals';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROUPS } from '../src/core/groups.js';
import {
  buildPresets,
  buildTaxonomyPresets,
  PACKAGE_NAME,
} from '../src/presets.js';
import { PLACEMENT, SECTION_DEFS } from '../src/core/taxonomy-data.js';
import registry, { hintsByGroup } from '../src/index.js';

const CONFIGS = join(import.meta.dirname, '..', 'configs');

describe('buildPresets', () => {
  const presets = buildPresets(hintsByGroup);

  it('creates a preset for every group', () => {
    expect(Object.keys(presets).sort()).toEqual([...GROUPS].sort());
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
    expect(ids).toEqual([...ids].sort());
  });

  it('only lists hints that belong to the group', () => {
    for (const group of GROUPS) {
      const expected = hintsByGroup[group].map((id) => `${PACKAGE_NAME}/${id}`);
      expect(Object.keys(presets[group].hints).sort()).toEqual(expected.sort());
    }
  });
});

describe('configs/*.json', () => {
  it('matches the registry (run with UPDATE_CONFIGS=1 to rewrite)', () => {
    const presets = buildPresets(hintsByGroup);
    for (const group of GROUPS) {
      const file = join(CONFIGS, `${group}.json`);
      const wanted = `${JSON.stringify(presets[group], null, 2)}\n`;
      if (process.env.UPDATE_CONFIGS === '1') {
        mkdirSync(CONFIGS, { recursive: true });
        writeFileSync(file, wanted);
      }
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(presets[group]);
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
    expect(names('plumbline-recommended').toSorted()).toEqual(
      ids
        .filter(
          (id) =>
            PLACEMENT[id]!.tier === 'recommended' &&
            SECTION_DEFS.find((s) => s.id === PLACEMENT[id]!.section)
              ?.defaultOn !== false,
        )
        .toSorted(),
    );
    expect(names('plumbline-experimental').toSorted()).toEqual(
      ids.filter((id) => PLACEMENT[id]!.tier === 'experimental').toSorted(),
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
  it('matches the registry (run with UPDATE_CONFIGS=1 to rewrite)', () => {
    const presets = buildTaxonomyPresets(Object.keys(registry));
    for (const [name, preset] of Object.entries(presets)) {
      const file = join(CONFIGS, `${name}.json`);
      if (process.env.UPDATE_CONFIGS === '1') {
        writeFileSync(file, `${JSON.stringify(preset, null, 2)}\n`);
      }
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(preset);
    }
  });
});
