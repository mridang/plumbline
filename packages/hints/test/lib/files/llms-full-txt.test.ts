import { describe, expect, it } from '@jest/globals';
import { validateLlmsFullTxt } from '../../../src/lib/files/llms-full-txt.js';

const msgs = (t: string) => validateLlmsFullTxt(t).map((i) => i.message);

describe('validateLlmsFullTxt', () => {
  it('accepts valid markdown', () => {
    expect(
      msgs('# A\n\ntext\n\n## B\n\n```js\n# not a heading\n```\n'),
    ).toEqual([]);
  });
  it('rejects an empty file', () => {
    expect(msgs('\n')[0]).toContain('empty');
  });
  it('requires an H1', () => {
    expect(msgs('## A\ntext')[0]).toContain('H1');
  });
  it('rejects an unclosed fence', () => {
    const i = validateLlmsFullTxt('# A\n```js\ncode');
    expect(i[0].line).toBe(2);
  });
  it('rejects empty headings', () => {
    expect(msgs('# A\ntext\n##')[0]).toContain('empty');
  });
  it('warns on skipped levels and extra H1s', () => {
    expect(msgs('# A\ntext\n### B')[0]).toContain('H1 to H3');
    expect(msgs('# A\ntext\n# B')[0]).toContain('more than one H1');
  });
  it('rejects headings without content', () => {
    expect(msgs('# A')[0]).toContain('no content');
  });
  it('gives a size hint for huge files', () => {
    const i = validateLlmsFullTxt(`# A\n${'x'.repeat(600 * 1000)}`);
    expect(i[0].severity).toBe('warning');
  });
});
