import { describe, expect, it } from '@jest/globals';

import { PageHeading } from '@/components/ui-app/page-heading';
import { html } from '../render';

describe('PageHeading', () => {
  it('has the page’s one h1, with the eyebrow above and the description under it', () => {
    const out = html(
      <PageHeading
        eyebrow="Dashboard"
        title="Your sites"
        description="How each stands."
      />,
    );
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('>Your sites</h1>');
    expect(out.indexOf('Dashboard')).toBeLessThan(out.indexOf('Your sites'));
    expect(out).toContain('How each stands.');
  });

  it('puts the actions to the right of the title', () => {
    const out = html(
      <PageHeading title="T" actions={<button type="button">Do</button>} />,
    );
    expect(out).toContain('justify-between');
    expect(out).toContain('>Do</button>');
  });

  it('draws nothing for the parts it is not given', () => {
    const out = html(<PageHeading title="T" />);
    expect(out).not.toContain('<p');
    expect(out).not.toContain('text-label');
  });

  it('is compact: no screen of space above the work', () => {
    const out = html(<PageHeading title="T" />);
    expect(out).toContain('py-6');
    expect(out).not.toContain('py-14');
  });

  it('puts children under it', () => {
    expect(
      html(
        <PageHeading title="T">
          <span>under</span>
        </PageHeading>,
      ),
    ).toContain('<span>under</span>');
  });
});
