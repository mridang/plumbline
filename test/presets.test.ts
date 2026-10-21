import { describe, expect, it } from '@jest/globals';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROUPS } from '../src/core/groups.js';
import { buildPresets, PACKAGE_NAME } from '../src/presets.js';
import { hintsByGroup } from '../src/index.js';

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
