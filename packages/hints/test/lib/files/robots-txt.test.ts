import { describe, expect, it } from '@jest/globals';
import {
  validateRobotsTxt,
  validateContentSignal,
} from '../../../src/lib/files/robots-txt.js';

const msgs = (t: string) => validateRobotsTxt(t).map((i) => i.message);

describe('validateRobotsTxt', () => {
  it('accepts a valid file', () => {
    expect(
      validateRobotsTxt(
        'User-agent: *\nDisallow: /private/\nAllow: /\nSitemap: https://a.com/s.xml\n',
      ),
    ).toEqual([]);
  });
  it('warns on an empty file', () => {
    expect(msgs('  ')[0]).toContain('empty');
  });
  it('rejects lines without a colon', () => {
    const i = validateRobotsTxt('User-agent: *\nbogus');
    expect(i[0].line).toBe(2);
    expect(i[0].message).toContain('Invalid line');
  });
  it('warns on unknown directives', () => {
    expect(msgs('User-agent: *\nFoo: bar')[0]).toContain(
      "Unknown directive 'foo'",
    );
  });
  it('rejects rules before a User-agent', () => {
    expect(msgs('Disallow: /a')[0]).toContain('before any User-agent');
  });
  it('rejects paths not starting with a slash', () => {
    expect(msgs('User-agent: *\nDisallow: admin')[0]).toContain(
      "must start with '/'",
    );
  });
  it('accepts an empty Disallow and wildcard paths', () => {
    expect(
      validateRobotsTxt('User-agent: *\nDisallow:\nDisallow: *.pdf'),
    ).toEqual([]);
  });
  it('rejects relative sitemaps', () => {
    expect(msgs('User-agent: *\nSitemap: /s.xml')[0]).toContain('absolute');
  });
  it('rejects an empty User-agent', () => {
    expect(msgs('User-agent:\nDisallow: /a')[0]).toContain('product token');
  });
  it('warns on Disallow / for all agents', () => {
    expect(msgs('User-agent: *\nDisallow: /').join(',')).toContain(
      'blocks the whole site',
    );
  });
  it('does not warn on Disallow / for a specific bot', () => {
    expect(msgs('User-agent: BadBot\nDisallow: /')).toEqual([]);
  });
  it('groups consecutive User-agent lines', () => {
    expect(
      msgs('User-agent: a\nUser-agent: *\nDisallow: /').join(','),
    ).toContain('blocks');
  });
  it('warns when a file has no group', () => {
    expect(msgs('Sitemap: https://a.com/s.xml')[0]).toContain(
      'no User-agent group',
    );
  });
  it('warns when the file is over 500 KiB', () => {
    expect(msgs(`User-agent: *\n# ${'x'.repeat(512 * 1024)}`)[0]).toContain(
      '500 KiB',
    );
  });
  it('requires Content-Signal in every group', () => {
    const i = validateRobotsTxt(
      'User-agent: *\nContent-Signal: search=yes\nUser-agent: GPTBot\nDisallow: /x',
    );
    expect(i).toHaveLength(1);
    expect(i[0].message).toContain('gptbot');
    expect(i[0].line).toBe(3);
  });
  it('accepts Content-Signal repeated in all groups', () => {
    expect(
      validateRobotsTxt(
        'User-agent: *\nContent-Signal: search=yes, ai-train=no\nUser-agent: GPTBot\nContent-Signal: ai-train=no\nDisallow: /x',
      ),
    ).toEqual([]);
  });
  it('reports invalid Content-Signal', () => {
    expect(msgs('User-agent: *\nContent-Signal: search=maybe')[0]).toContain(
      'must be yes or no',
    );
  });
  it('warns on Content-Signal before any group', () => {
    expect(msgs('Content-Signal: search=yes\nUser-agent: *')).toHaveLength(2);
  });
  it('ignores comments', () => {
    expect(
      validateRobotsTxt('# hi\nUser-agent: * # all\nDisallow: /a # x'),
    ).toEqual([]);
  });
});

describe('validateContentSignal', () => {
  it.each([
    ['', 'empty'],
    ['search', 'Invalid'],
    ['foo=yes', 'Unknown'],
    ['search=no, search=yes', 'more than once'],
  ])('rejects %j', (v, part) => {
    expect(validateContentSignal(v)).toContain(part);
  });
  it('accepts all three', () => {
    expect(
      validateContentSignal('search=yes, ai-input=no, ai-train=no'),
    ).toBeNull();
  });
});
