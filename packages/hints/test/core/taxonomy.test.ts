import { describe, expect, it } from '@jest/globals';
import hints from '../../src/index.js';
import {
  GROUP_DEFS,
  PLACEMENT,
  SECTIONS,
  SECTION_DEFS,
} from '../../src/core/taxonomy.js';

describe('the sections', () => {
  it('has between six and sixteen, each explained', () => {
    expect(SECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(SECTIONS.length).toBeLessThanOrEqual(16);
    for (const section of SECTIONS) {
      expect(section.title.length).toBeGreaterThanOrEqual(3);
      expect(section.description.length).toBeGreaterThan(10);
      expect(section.fixer.length).toBeGreaterThan(3);
    }
  });

  it('has no other bucket', () => {
    expect(SECTIONS.some((section) => section.id === 'other')).toBe(false);
  });

  it('numbers the sections in the order of their display groups', () => {
    expect(SECTIONS.map((section) => section.order)).toEqual(
      SECTIONS.map((_, index) => index),
    );
    expect(SECTIONS.map((section) => section.id)).toEqual(
      GROUP_DEFS.flatMap((group) => group.sections),
    );
  });

  it('carries the title of the display group', () => {
    const https = SECTIONS.find((section) => section.id === 'https');
    expect(https?.group).toBe('security-privacy');
    expect(https?.groupTitle).toBe('Security and privacy');
    expect(SECTION_DEFS).toHaveLength(SECTIONS.length);
  });
});

describe('the metadata stamped on a hint', () => {
  it('carries the placement, the tier and where the hint came from', () => {
    const docs = hints.csp.meta.docs as {
      section?: string;
      sectionTitle?: string;
      sectionOrder?: number;
      group?: string;
      groupTitle?: string;
      subsection?: string;
      tags?: string[];
      tier?: string;
      target?: string;
      control?: string;
      since?: number;
      added?: string;
      origins?: { source: string }[];
    };
    const placement = PLACEMENT.csp;
    expect(docs.section).toBe(placement.section);
    expect(docs.sectionTitle).toBeTruthy();
    expect(docs.sectionOrder).toBe(
      SECTIONS.findIndex((section) => section.id === placement.section),
    );
    expect(docs.group).toBeTruthy();
    expect(docs.groupTitle).toBeTruthy();
    expect(docs.subsection).toBe(placement.subsection);
    expect(docs.tags).toEqual([...placement.tags]);
    expect(docs.tier).toBe(placement.tier);
    expect(docs.target).toBe(placement.target);
    expect(docs.control).toBe(placement.control);
    expect(docs.since).toBe(placement.since);
    expect(docs.added).toBe(placement.added);
    expect(docs.origins?.length).toBeGreaterThan(0);
  });
});
