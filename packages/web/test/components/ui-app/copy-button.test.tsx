import { describe, expect, it } from '@jest/globals';

import { COPIED_MS, CopyButton } from '@/components/ui-app/copy-button';
import { html } from '../render';

describe('CopyButton', () => {
  it('is a button that says what it copies', () => {
    const out = html(<CopyButton value="abc" label="the evidence" />);
    expect(out).toContain('type="button"');
    expect(out).toContain('aria-label="Copy the evidence"');
    expect(out).toContain('title="Copy the evidence"');
  });

  it('draws the copy icon until something has been copied', () => {
    const out = html(<CopyButton value="abc" label="x" />);
    expect(out).toContain('<rect');
    expect(out).not.toContain('text-passed');
  });

  it('takes extra classes, to sit in the corner of a block', () => {
    expect(
      html(<CopyButton value="abc" label="x" className="absolute top-2" />),
    ).toContain('absolute top-2');
  });

  it('lets "Copied" stand for a moment and no longer', () => {
    expect(COPIED_MS).toBeGreaterThan(500);
    expect(COPIED_MS).toBeLessThan(5000);
  });
});
