import { describe, expect, it } from '@jest/globals';
import { escapeHtml, link, safeUrl } from '../src/html.js';
import { FTP_SCHEME, HTTP_SCHEME } from './helpers/data.js';

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe(
      '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;',
    );
  });

  it('treats undefined as empty', () => {
    expect(escapeHtml()).toBe('');
  });
});

describe('safeUrl', () => {
  it('accepts http and https', () => {
    expect(safeUrl(' https://a.test/x ')).toBe('https://a.test/x');
    expect(safeUrl(`${HTTP_SCHEME}a.test`)).toBe(`${HTTP_SCHEME}a.test`);
  });

  it.each([
    // eslint-disable-next-line no-script-url -- the value under test is a script URL that must be refused or shown as text
    'javascript:alert(1)',
    'data:text/html,x',
    '/relative',
    '',
    `${FTP_SCHEME}x`,
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
    // eslint-disable-next-line no-script-url -- the value under test is a script URL that must be refused or shown as text
    expect(link('javascript:alert("x")')).toBe(
      // eslint-disable-next-line no-script-url -- the value under test is a script URL shown as text
      'javascript:alert(&quot;x&quot;)',
    );
  });
});
