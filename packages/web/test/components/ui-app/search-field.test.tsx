import { describe, expect, it } from '@jest/globals';

import { SearchField } from '@/components/ui-app/search-field';
import { html } from '../render';

describe('SearchField', () => {
  const out = html(
    <SearchField
      label="Search sites"
      placeholder="Search sites"
      value="acme"
      onChange={() => undefined}
    />,
  );

  it('is a search box with a label that is read out and not shown', () => {
    expect(out).toContain('type="search"');
    expect(out).toContain('<span class="sr-only">Search sites</span>');
  });

  it('holds the text it is given, and a placeholder', () => {
    expect(out).toContain('value="acme"');
    expect(out).toContain('placeholder="Search sites"');
  });

  it('has the magnifying glass inside it', () => {
    expect(out).toContain('<circle');
    expect(out).toContain('pointer-events-none');
  });
});
