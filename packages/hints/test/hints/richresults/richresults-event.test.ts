import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-event.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-event', () => {
  it('does nothing when no Event node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on each missing required field', async () => {
    const problems = await runHint(hint, page({ '@type': 'Event' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      3,
    );
  });

  it('passes a complete Event', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'Event',
          name: 'Gig',
          startDate: '2026-01-01',
          location: { '@type': 'Place' },
          endDate: '2026-01-02',
        }),
      ),
    ).toEqual([]);
  });
});
