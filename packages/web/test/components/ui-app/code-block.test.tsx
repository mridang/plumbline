import { describe, expect, it } from '@jest/globals';

import { CodeBlock } from '@/components/ui-app/code-block';
import { html } from '../render';

describe('CodeBlock', () => {
  it('shows the code, labelled, and wraps long lines instead of scrolling', () => {
    const out = html(<CodeBlock label="An example">npx plumbline</CodeBlock>);
    expect(out).toContain('<code>npx plumbline</code>');
    expect(out).toContain('aria-label="An example"');
    expect(out).toContain('whitespace-pre-wrap');
  });

  it('never needs a scrollbar, so it needs no focus stop', () => {
    const out = html(<CodeBlock label="x">y</CodeBlock>);
    expect(out).not.toContain('tabindex');
    expect(out).not.toContain('overflow-x-auto');
  });
});
