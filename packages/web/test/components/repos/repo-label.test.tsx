import { describe, expect, it } from '@jest/globals';

import { RepoLabel, splitRepo } from '@/components/repos/repo-label';
import { html } from '../render';

describe('splitRepo', () => {
  it('splits owner and name, and copes with a name alone', () => {
    expect(splitRepo('acme/site')).toEqual({ owner: 'acme', name: 'site' });
    expect(splitRepo('site')).toEqual({ owner: '', name: 'site' });
    expect(splitRepo('acme/a/b')).toEqual({ owner: 'acme', name: 'a/b' });
  });
});

describe('RepoLabel', () => {
  it('shows the Octocat, the owner quietly and the name strongly, linked to the repository page', () => {
    const out = html(<RepoLabel repo="acme/site" />);
    expect(out).toContain('viewBox="0 0 16 16"');
    expect(out).toMatch(/text-muted">acme\/<\/span>/);
    expect(out).toMatch(/font-semibold">site<\/span>/);
    expect(out).toContain('href="/repos/acme/site"');
    expect(out).toContain('title="acme/site"');
  });

  it('can lead somewhere else, or be plain text', () => {
    expect(html(<RepoLabel repo="acme/site" href="/x" />)).toContain(
      'href="/x"',
    );
    expect(html(<RepoLabel repo="acme/site" href={false} />)).not.toContain(
      '<a',
    );
  });

  it('has a larger size for a page heading', () => {
    expect(html(<RepoLabel repo="a/b" size="lg" />)).toContain('text-xl');
  });

  it('truncates a long name instead of overflowing', () => {
    expect(html(<RepoLabel repo="a/b" />)).toContain('truncate');
  });
});
