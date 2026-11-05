import { describe, expect, it } from '@jest/globals';

import { EmptyState } from '@/components/ui-app/empty-state';
import { html } from '../render';

describe('EmptyState', () => {
  it('says what is missing and what to do about it', () => {
    const out = html(
      <EmptyState title="No sites yet" action={<a href="/github">Connect</a>}>
        Install the app.
      </EmptyState>,
    );
    expect(out).toContain('No sites yet');
    expect(out).toContain('Install the app.');
    expect(out).toContain('<a href="/github">Connect</a>');
  });

  it('can be only a title', () => {
    expect(html(<EmptyState title="Nothing" />)).not.toContain('<a');
  });
});
