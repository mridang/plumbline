import { describe, expect, it } from '@jest/globals';
import {
  buildSections,
  countFindings,
  sectionFor,
  type Finding,
  type HintInfo,
} from '../src/sections.js';

const hint = (id: string, over: Partial<HintInfo> = {}): HintInfo => ({
  id,
  name: id,
  description: '',
  category: 'security',
  groups: [],
  ...over,
});

const finding = (hintId: string, severity = 4): Finding => ({
  hintId,
  severity,
  message: 'm',
  resource: 'https://a.test/',
});

describe('sectionFor', () => {
  it('uses the first topic by precedence, not by listing order', () => {
    const info = hint('extra/a', { groups: ['seo', 'tls', 'owasp'] });
    expect(sectionFor(info)).toMatchObject({ key: 'tls', topic: 'tls' });
  });

  it('prefers agent over everything', () => {
    const info = hint('extra/a', { groups: ['seo', 'agent', 'dns'] });
    expect(sectionFor(info).title).toBe('Agent readiness');
  });

  it('falls back to the title-cased category', () => {
    const info = hint('axe/x', {
      category: 'best-practices',
      groups: ['owasp'],
    });
    expect(sectionFor(info)).toEqual({
      key: 'category-best-practices',
      title: 'Best Practices',
    });
  });
});

describe('countFindings', () => {
  it('folds information into hints', () => {
    expect(
      countFindings([
        finding('a', 4),
        finding('a', 3),
        finding('a', 2),
        finding('a', 1),
      ]),
    ).toEqual({ error: 1, warning: 1, hint: 2 });
  });
});

describe('buildSections', () => {
  it('orders topics first, then categories, and badges skip the topic', () => {
    const sections = buildSections(
      [
        hint('stock/a', { category: 'pwa' }),
        hint('extra/b', { groups: ['owasp', 'seo'] }),
        hint('extra/c', { groups: ['dns', 'internetnl'] }),
      ],
      [finding('extra/b')],
    );
    expect(sections.map((s) => s.key)).toEqual(['dns', 'seo', 'category-pwa']);
    expect(sections[1]?.hints[0]?.badges).toEqual(['owasp']);
    expect(sections[1]?.passed).toBe(false);
    expect(sections[0]?.passed).toBe(true);
  });

  it('puts failing hints before passed ones', () => {
    const sections = buildSections(
      [hint('extra/a', { name: 'A' }), hint('extra/b', { name: 'B' })],
      [finding('extra/b', 3)],
    );
    expect(sections[0]?.hints.map((b) => b.info.id)).toEqual([
      'extra/b',
      'extra/a',
    ]);
  });

  it('keeps findings of hints that are not in the list', () => {
    const sections = buildSections([], [finding('x/unknown')]);
    expect(sections[0]?.hints[0]?.info.id).toBe('x/unknown');
    expect(sections[0]?.counts.error).toBe(1);
  });
});
