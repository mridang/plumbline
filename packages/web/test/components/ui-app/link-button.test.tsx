import { describe, expect, it } from '@jest/globals';

import { LinkButton } from '@/components/ui-app/link-button';
import { htmlAt } from '../render';

const draw = (element: React.ReactElement) =>
  htmlAt(element, { pathname: '/' });

describe('LinkButton', () => {
  it('is a link that looks like a button', () => {
    const out = draw(<LinkButton href="/github">Connect GitHub</LinkButton>);
    expect(out).toContain('href="/github"');
    expect(out).toContain('rounded-control');
    expect(out).toContain('>Connect GitHub</a>');
  });

  it('can be an ordinary link, for an address the server redirects', () => {
    const out = draw(
      <LinkButton href="/auth/github/link" native>
        Go
      </LinkButton>,
    );
    expect(out).toContain('href="/auth/github/link"');
    expect(out).not.toContain('target=');
  });

  it('opens an outside address in a new tab, and says so', () => {
    const out = draw(
      <LinkButton href="https://example.com" external>
        Docs
      </LinkButton>,
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('(opens in a new tab)');
  });

  it('takes the look of a button variant', () => {
    expect(
      draw(
        <LinkButton href="/x" variant="outline">
          x
        </LinkButton>,
      ),
    ).toContain('border');
  });
});
