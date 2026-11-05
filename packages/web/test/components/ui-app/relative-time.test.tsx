import { describe, expect, it } from '@jest/globals';

import { RelativeTime, TICK_MS } from '@/components/ui-app/relative-time';
import { html } from '../render';

const NOW = Date.parse('2026-11-05T12:00:00.000Z');

describe('RelativeTime', () => {
  it('says how long ago, from the server clock it was given', () => {
    expect(
      html(<RelativeTime at="2026-11-05T10:00:00.000Z" now={NOW} />),
    ).toContain('2 hours ago');
  });

  it('says how long until, for a moment ahead', () => {
    expect(
      html(<RelativeTime at="2026-11-05T12:05:00.000Z" now={NOW} />),
    ).toContain('in 5 minutes');
  });

  it('keeps the full date and time, in UTC, as its tooltip, and the exact one machine-readable', () => {
    const out = html(<RelativeTime at="2026-11-05T10:00:00.000Z" now={NOW} />);
    expect(out).toContain('title="5 Nov 2026, 10:00 UTC"');
    expect(out).toContain('dateTime="2026-11-05T10:00:00.000Z"');
  });

  it('says "yesterday" and "now" in words', () => {
    expect(
      html(<RelativeTime at="2026-11-04T12:00:00.000Z" now={NOW} />),
    ).toContain('yesterday');
    expect(
      html(<RelativeTime at="2026-11-05T11:59:50.000Z" now={NOW} />),
    ).toContain('now');
  });

  it('refreshes twice a minute', () => {
    expect(TICK_MS).toBe(30_000);
  });
});
