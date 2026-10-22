import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-localbusiness.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-localbusiness', () => {
  it('does nothing when no LocalBusiness node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on missing name and address', async () => {
    const problems = await runHint(hint, page({ '@type': 'LocalBusiness' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      2,
    );
  });

  it('passes a complete LocalBusiness', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'LocalBusiness',
          name: 'Cafe',
          address: { '@type': 'PostalAddress' },
          openingHours: 'Mo-Fr',
          telephone: '+1',
        }),
      ),
    ).toEqual([]);
  });
});
