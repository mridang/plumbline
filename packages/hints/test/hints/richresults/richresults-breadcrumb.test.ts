import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-breadcrumb.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-breadcrumb', () => {
  it('does nothing when no BreadcrumbList node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on an empty itemListElement', async () => {
    const problems = await runHint(hint, page({ '@type': 'BreadcrumbList' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      1,
    );
  });

  it('passes a valid breadcrumb trail', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
            { '@type': 'ListItem', position: 2, name: 'Here' },
          ],
        }),
      ),
    ).toEqual([]);
  });
});
