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
    expect(html).toContain('Security headers');
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
    expect(html).toContain('TLS and certificates');
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
