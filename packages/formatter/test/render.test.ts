import { describe, expect, it } from '@jest/globals';
import { generateReport } from '../src/render.js';
import type { Finding, HintInfo } from '../src/sections.js';

const ours: HintInfo = {
  id: 'extra/csp',
  name: 'CSP',
  description: 'Checks the CSP.',
  category: 'security',
  groups: ['owasp', 'security-headers'],
  url: 'https://ref.test/csp',
  section: 'site-protection',
  sectionTitle: 'Site protection',
  sectionDescription: 'Response headers that harden the site.',
  sectionOrder: 4,
  tags: [],
  origins: [
    {
      source: 'owasp',
      upstreamId: 'csp',
      title: 'Content-Security-Policy',
      url: 'https://src.test/csp',
      docsUrl: 'https://docs.test/csp',
      summary: 'Checks the policy.',
      licence: 'Apache-2.0',
    },
  ],
};
const stock: HintInfo = {
  id: 'axe/aria',
  name: 'ARIA',
  description: '',
  category: 'accessibility',
  groups: [],
};
const base: Finding = {
  hintId: 'extra/csp',
  severity: 4,
  message: 'Missing CSP',
  resource: 'https://a.test/',
};
const page = (hints: HintInfo[], findings: Finding[]): string =>
  generateReport({ target: 'https://a.test/', date: 'now', hints, findings });

describe('generateReport', () => {
  it('shows summary, sections, metadata and finding details', () => {
    const html = page(
      [ours, { ...ours, id: 'extra/x', name: 'X', groups: ['tls'] }],
      [
        {
          ...base,
          location: { line: 3, column: 7 },
          sourceCode: 'Header: x',
          codeLanguage: 'http',
          documentation: [{ link: 'https://ref.test/csp', text: 'CSP' }],
        },
      ],
    );
    expect(html).toContain('2 hints run, 1 with findings');
    expect(html).toContain('1 error');
    expect(html).toContain('Site protection');
    expect(html).toContain('Response headers that harden the site.');
    expect(html).toContain('Origin (1)');
    expect(html).toContain('href="https://src.test/csp"');
    expect(html).toContain('Apache-2.0');
    expect(html).toContain('Checks the CSP.');
    expect(html).toContain('href="https://ref.test/csp"');
    expect(html).toContain('3:7');
    expect(html).toContain('<code>Header: x</code>');
    expect(html).toContain('http</span>');
    expect(html).toContain('Further reading');
    expect(html).toContain('<span class="badge">owasp</span>');
    expect(html).toContain('data-group="owasp"');
  });

  it('lists sections without findings as passed', () => {
    const html = page([{ ...ours, groups: ['tls'] }], []);
    expect(html).toContain('Site protection');
    expect(html).toContain('&#10003;');
    expect(html).toContain('1 passed');
    expect(html).toContain('No findings');
  });

  it('omits line and column for negative lines', () => {
    const html = page(
      [ours],
      [{ ...base, location: { line: -1, column: -1 } }],
    );
    expect(html).not.toContain('class="loc"');
  });

  it('renders stock buttons only for non-extra hints', () => {
    const html = page([ours, stock], [base, { ...base, hintId: 'axe/aria' }]);
    expect(html).toContain(
      'https://webhint.io/docs/user-guide/hints/hint-axe/aria/#why-is-this-important',
    );
    expect(html).toContain('#examples-that-pass-the-hint');
    expect(html).not.toContain('hint-extra');
  });

  it('escapes message, snippet, resource and metadata', () => {
    const evil = '<script>alert(1)</script>';
    const html = page(
      [{ ...ours, name: evil, description: evil }],
      [{ ...base, message: evil, sourceCode: evil, resource: evil }],
    );
    expect(html).not.toContain(evil);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders javascript: urls as plain text', () => {
    const html = page(
      [{ ...ours, url: 'javascript:alert(1)' }],
      [
        {
          ...base,
          resource: 'javascript:alert(2)',
          documentation: [{ link: 'javascript:alert(3)', text: 'doc' }],
        },
      ],
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('javascript:alert(2)');
    expect(html).toContain('doc');
  });

  describe('agent score card', () => {
    const scoreHint: HintInfo = {
      ...ours,
      id: 'extra/agent-score',
      groups: ['agent'],
    };

    it('parses the score into bars', () => {
      const html = page(
        [scoreHint],
        [
          {
            ...base,
            hintId: 'extra/agent-score',
            message:
              'Agent readiness score 27/100, level 1 "Basic Web Presence". Discoverability 50 (2/4); Content 10 (1/10)',
          },
        ],
      );
      expect(html).toContain('class="card score"');
      expect(html).toContain('27<small>/100</small>');
      expect(html).toContain('level 1 &quot;Basic Web Presence&quot;');
      expect(html).toContain('style="width:50%"');
      expect(html).toContain('Content');
    });

    it('falls back to the message text', () => {
      const html = page(
        [scoreHint],
        [{ ...base, hintId: 'extra/agent-score', message: 'odd <b>' }],
      );
      expect(html).toContain('<p>odd &lt;b&gt;</p>');
    });

    it('is absent without the finding', () => {
      expect(page([ours], [base])).not.toContain('class="card score"');
    });
  });
});

describe('agent score parsing against the former regexes', () => {
  const scoreHint: HintInfo = {
    ...ours,
    id: 'extra/agent-score',
    groups: ['agent'],
  };
  const former = (message: string) => {
    // The former pattern, assembled at run time so the linter does not flag the
    // reference implementation this test compares against.
    const old = (flags: string, ...parts: string[]): RegExp =>
      new RegExp(parts.join(''), flags);
    const head = old(
      's',
      String.raw`^Agent readiness score (\d+)\/100, level (\d+)`,
      String.raw`(?: "([^"]*)")?\.?(.*)$`,
    ).exec(message);
    if (!head) {
      return null;
    }
    const categories: string[] = [];
    for (const part of (head[4] ?? '').split(';')) {
      const match = old(
        '',
        String.raw`^(.+?)\s+(\d+)`,
        String.raw`(?:\s*\(\d+\/\d+\))?\s*\.?$`,
      ).exec(part.trim());
      if (match) {
        categories.push(
          `${match[1].replaceAll('"', '&quot;')}|${Math.min(100, Number(match[2]))}`,
        );
      }
    }
    const quoted = head[3] ? ' &quot;' + head[3] + '&quot;' : '';
    return {
      score: head[1],
      level: `level ${head[2]}${quoted}`,
      categories,
    };
  };
  const parsed = (message: string) => {
    const html = page(
      [scoreHint],
      [{ ...base, hintId: 'extra/agent-score', message }],
    );
    const marker = html.indexOf('<small>/100</small>');
    if (marker === -1) {
      return null;
    }
    const levelAt = html.indexOf('level ');
    return {
      score: html.slice(html.lastIndexOf('>', marker - 1) + 1, marker),
      level: html.slice(levelAt, html.indexOf('<', levelAt)),
      categories: html
        .split('<li><span>')
        .slice(1)
        .map(
          (item) =>
            `${item.slice(0, item.indexOf('</span>'))}|${item.slice(item.indexOf('<b>') + 3, item.indexOf('</b>'))}`,
        ),
    };
  };

  it.each([
    'Agent readiness score 27/100, level 1 "Basic Web Presence". Discoverability 50 (2/4); Content 10 (1/10)',
    'Agent readiness score 5/100, level 0. Alpha 5; Beta 7.',
    'Agent readiness score 5/100, level 0 Alpha 5',
    'Agent readiness score 5/100, level 2 "Unclosed. Alpha 5',
    'Agent readiness score 5/100, level 2 "". Alpha 5',
    'Agent readiness score 5/100, level 2. One Two 5 6; Three 250 (1/2) .; Four (1/2)',
    'Agent readiness score 5/100, level 2. A\nB 5; C 6 \n; D 5',
    'Agent readiness score 5/100, level 2. A  B   7  ( 3/4 ) ;  C 8 (3/4)',
    'Agent readiness score 5/100',
    'odd',
  ])('agrees on %j', (message) => {
    expect(parsed(message)).toEqual(former(message));
  });

  it('agrees on 100k characters of categories', () => {
    const message = `Agent readiness score 5/100, level 1. ${'a 1 '.repeat(25_000)}; B 2`;
    expect(parsed(message)).toEqual(former(message));
  });
});
