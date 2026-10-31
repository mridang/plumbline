import { describe, expect, it } from '@jest/globals';

import { Scanner } from '@/app/(site)/_components/scanner';
import { html } from '../../../components/render';

describe('Scanner', () => {
  it('starts with a labelled box for the domain and a scan button', () => {
    const out = html(<Scanner />);
    expect(out).toContain('role="search"');
    expect(out).toContain('<label for="domain"');
    expect(out).toContain('placeholder="example.com"');
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Scan<\/button>/);
  });

  it('shows no results before a scan', () => {
    expect(html(<Scanner />)).not.toContain('Results for');
  });
});
