import { describe, expect, it } from '@jest/globals';
import { escapeHtml, link, safeUrl } from '../src/html.js';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe(
      '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;',
    );
  });

  it('treats undefined as empty', () => {
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('safeUrl', () => {
  it('accepts http and https', () => {
    expect(safeUrl(' https://a.test/x ')).toBe('https://a.test/x');
    expect(safeUrl('http://a.test')).toBe('http://a.test');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '/relative',
    '',
    'ftp://x',
  ])('refuses %s', (url) => {
    expect(safeUrl(url)).toBeUndefined();
  });
});

describe('link', () => {
  it('renders an anchor with escaped text', () => {
    expect(link('https://a.test/?a=1&b=2', '<b>')).toBe(
      '<a href="https://a.test/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">&lt;b&gt;</a>',
    );
  });

  it('renders plain escaped text for unsafe urls', () => {
    expect(link('javascript:alert("x")')).toBe(
      'javascript:alert(&quot;x&quot;)',
    );
  });
});
