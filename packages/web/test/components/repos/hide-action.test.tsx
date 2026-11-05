import { describe, expect, it } from '@jest/globals';

import { HideAction } from '@/components/repos/hide-action';
import { htmlAt } from '../render';

describe('HideAction', () => {
  it('offers to hide a repository from the dashboard', () => {
    const out = htmlAt(<HideAction repo="acme/site" hidden={false} />);
    expect(out).toContain('Hide from dashboard');
    expect(out).toContain('type="button"');
  });

  it('offers to unhide one that is hidden', () => {
    expect(htmlAt(<HideAction repo="acme/site" hidden />)).toContain('Unhide');
  });
});
