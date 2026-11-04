import { describe, expect, it } from '@jest/globals';

import { RunChecks } from '@/app/(site)/domains/[id]/_components/run-checks';
import { htmlAt } from '../../../../../components/render';

/** The button and status for a domain that runs these checks. */
const render = (checks: readonly string[]) =>
  htmlAt(<RunChecks domainId="d1" host="example.com" checks={checks} />);

describe('RunChecks', () => {
  it('offers to run the checks chosen, counting them', () => {
    expect(render(['csp', 'etag'])).toMatch(
      /<button[^>]*>Run 2 checks<\/button>/,
    );
  });

  it('says "check" for one', () => {
    expect(render(['csp'])).toMatch(/<button[^>]*>Run 1 check<\/button>/);
  });

  it('can be pressed while there are checks to run', () => {
    expect(render(['csp'])).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('cannot be pressed when no checks are chosen', () => {
    expect(render([])).toMatch(/<button[^>]*disabled=""[^>]*>Run 0 checks/);
  });

  it('says nothing about saving before a scan', () => {
    expect(render(['csp'])).toContain(
      '<p aria-live="polite" class="text-sm text-muted"></p>',
    );
  });

  it('shows no results before a scan', () => {
    expect(render(['csp'])).not.toContain('Results for');
  });
});
