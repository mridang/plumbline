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
  it('uses the section stamped on the hint', () => {
    const info = hint('extra/a', {
      section: 'https-tls',
      sectionTitle: 'HTTPS and certificates',
      groups: ['seo', 'tls'],
    });
    expect(sectionFor(info)).toEqual({
      key: 'https-tls',
      title: 'HTTPS and certificates',
    });
  });

  it('title-cases the section id when no title was stamped', () => {
    expect(sectionFor(hint('extra/a', { section: 'dns-network' })).title).toBe(
      'Dns Network',
    );
  });

  it('falls back to the title-cased category for hints without a section', () => {
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

const stamped = (
  id: string,
  section: string,
  title: string,
  order: number,
  over: Partial<HintInfo> = {},
): HintInfo =>
  hint(id, {
    section,
    sectionTitle: title,
    sectionDescription: `About ${title}`,
    sectionOrder: order,
    ...over,
  });

describe('buildSections', () => {
  it('orders stamped sections by their stamped order, then other categories', () => {
    const sections = buildSections(
      [
        hint('stock/a', { category: 'pwa' }),
        stamped('extra/b', 'search', 'Search', 1),
        stamped('extra/c', 'llms-ai', 'LLMs and AI', 0),
      ],
      [finding('extra/b')],
    );
    expect(sections.map((s) => s.key)).toEqual([
      'llms-ai',
      'search',
      'category-pwa',
    ]);
    expect(sections[1]?.passed).toBe(false);
    expect(sections[0]?.passed).toBe(true);
    expect(sections[0]?.description).toBe('About LLMs and AI');
  });

  it('shows source groups and the titles of tagged sections as badges', () => {
    const sections = buildSections(
      [
        stamped('extra/a', 'search', 'Search', 1, {
          groups: ['owasp', 'seo'],
          tags: ['llms-ai'],
        }),
        stamped('extra/b', 'llms-ai', 'LLMs and AI', 0),
      ],
      [],
    );
    const search = sections.find((s) => s.key === 'search');
    expect(search?.hints[0]?.badges).toEqual(['owasp', 'LLMs and AI']);
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
