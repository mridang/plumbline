import { describe, expect, it } from '@jest/globals';

import { NO_FILTER, countsOf } from '@/components/repos/site-filter';
import { StatusFilterBar } from '@/components/repos/status-filter-bar';
import { htmlAt } from '../render';

const labels = (html: string): string[] =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

describe('StatusFilterBar', () => {
  it('always has the same chips in the same order, at zero too', () => {
    const empty = labels(
      htmlAt(
        <StatusFilterBar
          counts={countsOf([])}
          filter={NO_FILTER}
          onChange={() => {}}
        />,
      ),
    );
    expect(empty).toEqual([
      'All 0',
      'Failing 0',
      'Warnings 0',
      'Passing 0',
      'Checking 0',
      'Unchecked 0',
      'Unresponsive 0',
      'Show paused 0',
    ]);
  });

  it('presses All when nothing is set, and the chosen chip otherwise', () => {
    const none = htmlAt(
      <StatusFilterBar
        counts={countsOf([])}
        filter={NO_FILTER}
        onChange={() => {}}
      />,
    );
    expect(none.match(/aria-pressed="true"/g)).toHaveLength(1);
    const failing = htmlAt(
      <StatusFilterBar
        counts={countsOf([])}
        filter={{ status: 'failing', paused: true }}
        onChange={() => {}}
      />,
    );
    expect(failing.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(failing).toMatch(
      /aria-pressed="true"[^>]*>(?:<[^>]+>)*[^<]*Failing/,
    );
  });

  it('is a labelled group of real buttons', () => {
    const out = htmlAt(
      <StatusFilterBar
        counts={countsOf([])}
        filter={NO_FILTER}
        onChange={() => {}}
      />,
    );
    expect(out).toContain('role="group"');
    expect(out).toContain('type="button"');
  });
});
