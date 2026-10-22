import { describe, expect, it } from '@jest/globals';
import { validateLlmsTxt } from '../../../src/lib/files/llms-txt.js';

const valid = `# Acme

> Summary

Some prose.

## Docs

- [Guide](https://a.com/guide.md): How to
- [API](https://a.com/api.md)

## Optional

- [Extra](https://a.com/x.md)
`;
const msgs = (t: string) => validateLlmsTxt(t).map((i) => i.message);

describe('validateLlmsTxt', () => {
  it('accepts a valid file', () => {
    expect(msgs(valid)).toEqual([]);
  });
  it('rejects an empty file', () => {
    expect(msgs('')[0]).toContain('empty');
  });
  it('requires an H1 first', () => {
    expect(msgs('Hello\n## A\n- [a](https://a.com)')[0]).toContain('H1');
  });
  it('rejects a second H1', () => {
    expect(msgs('# A\n> s\n# B')[0]).toContain('only one H1');
  });
  it('rejects non-link list items', () => {
    const i = validateLlmsTxt('# A\n> s\n## S\n- plain');
    expect(i[0].line).toBe(4);
  });
  it('rejects relative links and warns on http', () => {
    expect(msgs('# A\n> s\n## S\n- [a](/x.md)')[0]).toContain('absolute');
    expect(msgs('# A\n> s\n## S\n- [a](http://a.com/x)')[0]).toContain('HTTPS');
  });
  it('warns on empty and repeated sections', () => {
    expect(msgs('# A\n> s\n## S\n## S\n')).toEqual([
      "The section 'S' has no links.",
      "The section 'S' is repeated.",
      "The section 'S' has no links.",
      'The file has no H2 section with a list of links.',
    ]);
  });
  it('warns on H3 headings but ignores code fences', () => {
    expect(msgs('# A\n> s\n### x').join()).toContain('Only H2');
    expect(msgs('# A\n> s\n```\n# B\n```')).toEqual([
      'The file has no H2 section with a list of links.',
    ]);
  });
  it('warns on a missing blockquote summary', () => {
    expect(msgs('# A\n## S\n- [a](https://a.com/x)')).toEqual([
      'The file has no blockquote summary (> ...) after the title.',
    ]);
  });
  it('warns on duplicate URLs', () => {
    expect(
      msgs('# A\n> s\n## S\n- [a](https://a.com/x)\n- [b](https://a.com/x)')[0],
    ).toContain('more than once');
  });
  it('warns when there is no link section', () => {
    expect(msgs('# A\n> s\nprose')).toEqual([
      'The file has no H2 section with a list of links.',
    ]);
  });
  it('warns above 500 KB', () => {
    expect(
      msgs(`# A\n> s\n## S\n- [a](https://a.com/x)\n${'x'.repeat(501000)}`)[0],
    ).toContain('500 KB');
  });
});
