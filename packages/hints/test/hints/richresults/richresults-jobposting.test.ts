import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-jobposting.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-jobposting', () => {
  it('does nothing when no JobPosting node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on each missing required field including jobLocation', async () => {
    const problems = await runHint(hint, page({ '@type': 'JobPosting' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      5,
    );
  });

  it('passes a complete on-site JobPosting', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'JobPosting',
          title: 'T',
          description: 'D',
          datePosted: '2026-01-01',
          hiringOrganization: { '@type': 'Organization' },
          jobLocation: { '@type': 'Place' },
          validThrough: '2026-02-01',
          baseSalary: { '@type': 'MonetaryAmount' },
        }),
      ),
    ).toEqual([]);
  });
});
