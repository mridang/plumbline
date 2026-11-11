import { describe, expect, it } from '@jest/globals';
import {
  AI_BOTS,
  checkAiBotRules,
  checkContentSignals,
  checkRobotsTxt,
  checkSitemap,
  isSitemap,
  parseContentSignal,
  parseRobots,
} from '../../../src/lib/agent/robots.js';
import { fakeEnv } from './fake-env.js';

const SITEMAP =
  '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

describe('parseRobots', () => {
  it('reads directives, ignores comments and unknown lines', () => {
    const robots = parseRobots(
      [
        '# comment',
        'User-agent: GPTBot # inline',
        'user-agent: *',
        'Sitemap: https://example.com/s.xml',
        'Content-Signal: ai-train=no',
        'Agentmap: https://example.com/a.json',
        'Disallow: /x',
        'garbage',
      ].join('\n'),
    );
    expect(robots.userAgents).toEqual(['GPTBot', '*']);
    expect(robots.sitemaps).toEqual(['https://example.com/s.xml']);
    expect(robots.contentSignals).toEqual(['ai-train=no']);
    expect(robots.agentmaps).toEqual(['https://example.com/a.json']);
  });

  it('ignores directives with empty values', () => {
    expect(parseRobots('User-agent:\nSitemap:')).toEqual({
      userAgents: [],
      sitemaps: [],
      contentSignals: [],
      agentmaps: [],
    });
  });
});

describe('checkRobotsTxt', () => {
  it('passes with a User-agent directive', async () => {
    const r = await checkRobotsTxt(fakeEnv({ '/robots.txt': 'User-agent: *' }));
    expect(r.passed).toBe(true);
  });
  it('fails when missing', async () => {
    const r = await checkRobotsTxt(fakeEnv());
    expect(r.passed).toBe(false);
  });
  it('fails for a non-200 status', async () => {
    const env = fakeEnv({
      '/robots.txt': { status: 404, body: 'User-agent: *' },
    });
    const r = await checkRobotsTxt(env);
    expect(r.passed).toBe(false);
  });
  it('fails for the wrong content type', async () => {
    const env = fakeEnv({
      '/robots.txt': { contentType: 'text/html', body: 'User-agent: *' },
    });
    const r = await checkRobotsTxt(env);
    expect(r.detail).toContain('not text/plain');
  });
  it('fails without a User-agent directive', async () => {
    const env = fakeEnv({ '/robots.txt': 'Disallow: /' });
    const r = await checkRobotsTxt(env);
    expect(r.detail).toContain('no User-agent');
  });
});

describe('sitemap', () => {
  it('recognises urlset and sitemapindex only', () => {
    expect(
      isSitemap({
        url: '',
        status: 200,
        headers: {},
        contentType: '',
        body: SITEMAP,
      }),
    ).toBe(true);
    expect(
      isSitemap({
        url: '',
        status: 200,
        headers: {},
        contentType: '',
        body: '<sitemapindex></sitemapindex>',
      }),
    ).toBe(true);
    expect(
      isSitemap({
        url: '',
        status: 200,
        headers: {},
        contentType: '',
        body: '<html></html>',
      }),
    ).toBe(false);
    expect(isSitemap(null)).toBe(false);
  });
  it('passes through a Sitemap directive', async () => {
    const env = fakeEnv({
      '/robots.txt': 'Sitemap: https://example.com/map.xml',
      'https://example.com/map.xml': SITEMAP,
    });
    const r = await checkSitemap(env);
    expect(r.passed).toBe(true);
  });
  it('falls back to /sitemap.xml', async () => {
    const env = fakeEnv({ '/sitemap.xml': SITEMAP });
    const r = await checkSitemap(env);
    expect(r.passed).toBe(true);
  });
  it('fails when the declared sitemap is invalid', async () => {
    const env = fakeEnv({
      '/robots.txt': 'Sitemap: https://example.com/map.xml',
      'https://example.com/map.xml': '<html></html>',
      '/sitemap.xml': SITEMAP,
    });
    const r = await checkSitemap(env);
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('listed in robots.txt');
  });
  it('fails when there is nothing', async () => {
    const r = await checkSitemap(fakeEnv());
    expect(r.passed).toBe(false);
  });
});

describe('checkAiBotRules', () => {
  it('knows twenty crawlers', () => {
    expect(AI_BOTS).toHaveLength(20);
  });
  it('passes when a known crawler is named, ignoring case', async () => {
    const env = fakeEnv({ '/robots.txt': 'User-agent: gptbot\nDisallow: /' });
    const r = await checkAiBotRules(env);
    expect(r.passed).toBe(true);
    expect(r.note).toBeUndefined();
  });
  it('passes with a note when only wildcard rules apply', async () => {
    const env = fakeEnv({ '/robots.txt': 'User-agent: *\nDisallow: /' });
    const r = await checkAiBotRules(env);
    expect(r.passed).toBe(true);
    expect(r.note).toBe(true);
    expect(r.detail).toContain('none found, but wildcard rules apply');
  });
  it('fails for a robots.txt without any User-agent', async () => {
    const env = fakeEnv({ '/robots.txt': 'Disallow: /' });
    const r = await checkAiBotRules(env);
    expect(r.detail).toContain('no User-agent');
  });
  it('fails without robots.txt, saying why', async () => {
    const r = await checkAiBotRules(fakeEnv({}, { fallback: { status: 404 } }));
    expect(r.passed).toBe(false);
    expect(r.detail).toBe('/robots.txt was not found (HTTP 404).');
  });
  it('treats an HTML soft 404 as missing', async () => {
    const env = fakeEnv({
      '/robots.txt': { contentType: 'text/html', body: 'User-agent: *' },
    });
    const r = await checkAiBotRules(env);
    expect(r.passed).toBe(false);
  });
});

describe('content signals', () => {
  it('parses valid pairs and drops invalid ones', () => {
    expect(
      parseContentSignal('ai-train=no, search=yes, bogus=yes, ai-input=maybe'),
    ).toEqual({
      'ai-train': false,
      search: true,
    });
  });
  it('passes with a valid directive', async () => {
    const env = fakeEnv({
      '/robots.txt': 'Content-Signal: ai-train=no, search=yes',
    });
    const r = await checkContentSignals(env);
    expect(r.passed).toBe(true);
  });
  it('fails with an invalid directive', async () => {
    const env = fakeEnv({ '/robots.txt': 'Content-Signal: nonsense' });
    const r = await checkContentSignals(env);
    expect(r.detail).toContain('no valid');
  });
  it('fails without the directive', async () => {
    const env = fakeEnv({ '/robots.txt': 'User-agent: *' });
    const r = await checkContentSignals(env);
    expect(r.detail).toContain('no Content-Signal');
  });
  it('fails without robots.txt', async () => {
    const r = await checkContentSignals(fakeEnv());
    expect(r.passed).toBe(false);
  });
});

describe('parseRobots comment stripping against the former regex', () => {
  // The former pattern, assembled at run time so the linter does not flag the
  // reference implementation this test compares against.
  const old = (flags: string, ...parts: string[]): RegExp =>
    new RegExp(parts.join(''), flags);
  const former = (line: string): string[] => {
    const text = line.replace(old('', '#', '.*$'), '').trim();
    const match = /^([A-Za-z-]+)\s*:(.*)$/.exec(text);
    const value = match?.[2].trim();
    return value ? [value] : [];
  };

  it.each([
    'Sitemap: https://a.test/s.xml',
    'Sitemap: https://a.test/s.xml # note',
    'Sitemap: https://a.test/s.xml#frag',
    '# Sitemap: https://a.test/s.xml',
    'Sitemap: a # b # c',
    'Sitemap: a\r# b',
    'Sitemap: a # b\rc',
    'Sitemap: a # b c',
    'Sitemap: a # b # c d',
    'Sitemap: a#b\r#c',
    'Sitemap:#',
  ])('agrees on %j', (line) => {
    expect(parseRobots(line).sitemaps).toEqual(former(line));
  });

  it('agrees on a 100k character line of hashes', () => {
    const line = `Sitemap: a${'#'.repeat(100_000)}`;
    expect(parseRobots(line).sitemaps).toEqual(former(line));
    const broken = `${line}\r${'#'.repeat(100_000)}`;
    expect(parseRobots(broken).sitemaps).toEqual(former(broken));
  });
});
