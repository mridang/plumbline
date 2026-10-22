import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-video.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-video', () => {
  it('does nothing when no VideoObject node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on each missing required field', async () => {
    const problems = await runHint(hint, page({ '@type': 'VideoObject' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      3,
    );
  });

  it('passes a complete VideoObject', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'VideoObject',
          name: 'V',
          thumbnailUrl: 't.jpg',
          uploadDate: '2026-01-01',
          description: 'd',
        }),
      ),
    ).toEqual([]);
  });
});
