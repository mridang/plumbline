import { describe, expect, it } from '@jest/globals';

import { RunChecks } from '@/app/(site)/domains/[id]/_components/run-checks';
import { htmlAt } from '../../../../../components/render';

/** The button and status for a domain that runs these checks. */
const render = (checks: readonly string[]) =>
  htmlAt(<RunChecks domainId="d1" host="example.com" checks={checks} />);

/** The button for a site last run by hand `secondsAgo` seconds ago. */
const pageRunAgo = (secondsAgo: number) =>
  htmlAt(
    <RunChecks
      domainId="d1"
      host="example.com"
      checks={['csp']}
      lastRunAt={new Date(Date.now() - secondsAgo * 1000).toISOString()}
    />,
  );

describe('RunChecks', () => {
  it('is disabled with the time left to wait when the site was run by hand a minute ago', () => {
    const html = pageRunAgo(60);
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toMatch(/Run again in (3:5\d|4:00)/);
  });

  it('can be pressed again once five minutes have passed', () => {
    const html = pageRunAgo(301);
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('Run 1 check');
  });

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
