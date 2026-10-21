import { describe, expect, it } from '@jest/globals';
import {
  detectAiTxtFormat,
  validateAiTxt,
} from '../../../src/lib/files/ai-txt.js';

const md = `---
updated: 2026-01-01
scope: Acme store
---

# Acme

## What We Offer

x

## What We Do Not Offer

y

## Guidance for AI Assistants

z
`;
const spawning = `User-Agent: *
Disallow: *
User-Agent: GPTBot
Allow: images
Sitemap: https://a.com/s.xml
`;
const msgs = (t: string) => validateAiTxt(t).issues.map((i) => i.message);

describe('ai-txt', () => {
  it('detects formats', () => {
    expect(detectAiTxtFormat(md)).toBe('markdown');
    expect(detectAiTxtFormat(spawning)).toBe('spawning');
  });
  it('accepts both valid formats', () => {
    expect(msgs(md)).toEqual([]);
    expect(msgs(spawning)).toEqual([]);
  });
  it('rejects an empty file', () => {
    expect(msgs('')[0]).toContain('empty');
  });
  it('checks markdown front matter', () => {
    expect(msgs('# A')[0]).toContain('front matter');
    expect(msgs('---\nupdated: 2026-01-01\n# A')[0]).toContain('never closed');
    expect(msgs(md.replace('2026-01-01', 'soon'))[0]).toContain('YYYY-MM-DD');
    expect(msgs(md.replace('updated: 2026-01-01\n', ''))[0]).toContain(
      "'updated'",
    );
    expect(msgs(md.replace('scope: Acme store\n', ''))[0]).toContain("'scope'");
  });
  it('requires an H1 and warns on missing sections', () => {
    expect(msgs(md.replace('# Acme', ''))[0]).toContain('H1');
    expect(msgs(md.replace('## What We Offer', '## Other'))[0]).toContain(
      'What We Offer',
    );
  });
  it('rejects malformed spawning keys', () => {
    const i = validateAiTxt('user agent: *\nDisallow: images').issues;
    expect(i[0].message).toContain("use 'User-Agent'");
    expect(i[0].line).toBe(1);
  });
  it('rejects an orphan Allow', () => {
    expect(msgs('Allow: images\nUser-Agent: *')[0]).toContain(
      'before any User-Agent',
    );
  });
  it('warns on unknown tokens', () => {
    // No deprecated user agents are documented, so none is flagged.
    expect(msgs('User-Agent: anthropic-ai\nDisallow: images')).toEqual([]);
    expect(msgs('User-Agent: *\nDisallow: bogus')[0]).toContain(
      'Unknown media type',
    );
  });
  it('rejects invalid sitemaps, unknown keys, bad lines and missing agents', () => {
    expect(msgs('User-Agent: *\nAllow: *\nSitemap: nope')[0]).toContain(
      'absolute',
    );
    expect(msgs('User-Agent: *\nFoo: x')[0]).toContain('Unknown key');
    expect(msgs('User-Agent: *\njunk')[0]).toContain('Invalid line');
    expect(msgs('Sitemap: https://a.com/s')[0]).toContain('no User-Agent');
    expect(msgs('User-Agent: *')[0]).toContain('no Allow or Disallow');
  });
});
