import { describe, expect, it } from '@jest/globals';

import { CountCell, Stat } from '@/components/ui-app/stat';
import { html } from '../render';

describe('Stat', () => {
  it('shows the figure under its label, coloured by its tone', () => {
    const out = html(<Stat label="Failed" value={15} tone="bad" />);
    expect(out).toContain('>Failed</dt>');
    expect(out).toContain('text-failed');
    expect(out).toContain('>15<');
  });

  it('mutes a zero', () => {
    const out = html(<Stat label="Failed" value={0} tone="bad" />);
    expect(out).not.toContain('text-failed');
    expect(out).toContain('text-subtle');
  });
});

describe('CountCell', () => {
  it('colours a count and says its word to people who hear the page', () => {
    const out = html(<CountCell value={3} word="warned" tone="warn" />);
    expect(out).toContain('text-warned');
    expect(out).toContain('<span class="sr-only"> warned</span>');
  });

  it('mutes a zero', () => {
    const out = html(<CountCell value={0} word="failed" tone="bad" />);
    expect(out).toContain('text-subtle');
    expect(out).not.toContain('font-semibold');
  });

  it('shows a dash for a count that was not kept', () => {
    const out = html(<CountCell value={null} word="passed" tone="good" />);
    expect(out).toContain('>–</span>');
    expect(out).toContain('passed: not kept for this run');
  });
});
