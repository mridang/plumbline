import { describe, expect, it } from '@jest/globals';

import {
  ResultBadge,
  SiteStanding,
  SiteStateMarker,
} from '@/components/repos/site-status';
import { htmlAt } from '../render';

describe('SiteStanding', () => {
  it('shows the result as the badge and nothing else for a live site', () => {
    const out = htmlAt(<SiteStanding state="failing" paused={false} />);
    expect(out).toContain('Failing');
    expect(out).not.toContain('Paused');
    expect(out).not.toContain('Unresponsive');
  });

  it('marks a paused site with Paused beside its last result', () => {
    const out = htmlAt(<SiteStanding state="ok" paused />);
    expect(out).toContain('Passing');
    expect(out).toContain('>Paused<');
  });

  it('marks a site that does not answer as Unresponsive, with no result', () => {
    const out = htmlAt(<SiteStanding state="unreachable" paused={false} />);
    expect(out).toContain('No result');
    expect(out).toContain('>Unresponsive<');
  });
});

describe('ResultBadge and SiteStateMarker', () => {
  it('names every result in words', () => {
    const words = (
      ['failing', 'warning', 'ok', 'running', 'unchecked'] as const
    ).map((r) => htmlAt(<ResultBadge result={r} />));
    expect(words[0]).toContain('Failing');
    expect(words[1]).toContain('Warnings');
    expect(words[2]).toContain('Passing');
    expect(words[3]).toContain('Checking');
    expect(words[4]).toContain('Unchecked');
  });

  it('draws nothing for a live site', () => {
    expect(htmlAt(<SiteStateMarker state="ok" paused={false} />)).toBe('');
  });
});
