import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-is-url.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-is-url', () => {
  it('passes with prose', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="Read about our product">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports an https URL', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="https://example.com/product">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('starts with a URL');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-is-url',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('reports an http URL', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:description" content="http://example.com">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('starts with a URL');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-is-url',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('passes when a URL comes later', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="See https://example.com">',
        ),
      ),
    ).toEqual([]);
  });

  it('carries the offending tag and its location', async () => {
    const [problem] = await runHint(
      hint,
      page('<meta property="og:description" content="https://example.com/x">'),
    );
    expect(problem.sourceCode).toContain(
      '<meta property="og:description" content="https://example.com/x">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
