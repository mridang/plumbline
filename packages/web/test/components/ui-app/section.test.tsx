import { describe, expect, it } from '@jest/globals';

import { Section } from '@/components/ui-app/section';
import { html } from '../render';

describe('Section', () => {
  it('is a labelled region with a heading, its description and its content', () => {
    const out = html(
      <Section id="badge" title="Badge" description="How it looks.">
        <p>content</p>
      </Section>,
    );
    expect(out).toContain('aria-labelledby="badge-heading"');
    expect(out).toContain('<h2 id="badge-heading"');
    expect(out).toContain('>Badge</h2>');
    expect(out).toContain('How it looks.');
    expect(out).toContain('<p>content</p>');
  });

  it('puts its actions beside the heading', () => {
    const out = html(
      <Section title="Runs" actions={<button type="button">Go</button>}>
        x
      </Section>,
    );
    expect(out).toContain('<button type="button">Go</button>');
  });

  it('can be a smaller heading', () => {
    expect(
      html(
        <Section title="Runs" as="h3">
          x
        </Section>,
      ),
    ).toContain('<h3');
  });
});
