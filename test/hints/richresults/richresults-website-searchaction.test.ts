import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-website-searchaction.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-website-searchaction', () => {
  it('does nothing for a WebSite with no SearchAction', async () => {
    expect(await runHint(hint, page({ '@type': 'WebSite' }))).toEqual([]);
  });

  it('errors on a SearchAction missing target and query-input', async () => {
    const problems = await runHint(
      hint,
      page({
        '@type': 'WebSite',
        potentialAction: { '@type': 'SearchAction' },
      }),
    );
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      2,
    );
  });

  it('passes a complete SearchAction', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'WebSite',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://x.test/s?q={q}',
            'query-input': 'required name=q',
          },
        }),
      ),
    ).toEqual([]);
  });
});
