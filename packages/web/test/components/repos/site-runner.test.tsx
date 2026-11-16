import { describe, expect, it } from '@jest/globals';

import { SiteRunner } from '@/components/repos/site-runner';
import { htmlAt } from '../render';

/** Matches a disabled button. */
const DISABLED_BUTTON = /<button[^>]*disabled=""/;
/** Matches the run-again countdown text. */
const RUN_AGAIN_COUNTDOWN = /Run again in (3:5\d|4:00)/;
/** Matches the run button for two checks. */
const RUN_TWO_CHECKS_BUTTON = /<button[^>]*>Run 2 checks<\/button>/;
/** Matches the run button for one check. */
const RUN_ONE_CHECK_BUTTON = /<button[^>]*>Run 1 check<\/button>/;
/** Matches the disabled run button for zero checks. */
const RUN_ZERO_CHECKS_BUTTON = /<button[^>]*disabled=""[^>]*>Run 0 checks/;

/** The button and status for a domain that runs these checks. */
const draw = (checks: readonly string[]) =>
  htmlAt(
    <SiteRunner
      domainId="d1"
      host="example.com"
      checks={checks}
      identity={<span>who</span>}
    />,
  );

/** The button for a site last run by hand `secondsAgo` seconds ago. */
const pageRunAgo = (secondsAgo: number) =>
  htmlAt(
    <SiteRunner
      domainId="d1"
      host="example.com"
      checks={['csp']}
      identity={<span>who</span>}
      lastRunAt={new Date(Date.now() - secondsAgo * 1000).toISOString()}
    />,
  );

describe('SiteRunner', () => {
  it('is disabled with the time left to wait when the site was run by hand a minute ago', () => {
    const html = pageRunAgo(60);
    expect(html).toMatch(DISABLED_BUTTON);
    expect(html).toMatch(RUN_AGAIN_COUNTDOWN);
  });

  it('can be pressed again once five minutes have passed', () => {
    const html = pageRunAgo(301);
    expect(html).not.toMatch(DISABLED_BUTTON);
    expect(html).toContain('Run 1 check');
  });

  it('offers to run the checks chosen, counting them', () => {
    expect(draw(['csp', 'etag'])).toMatch(RUN_TWO_CHECKS_BUTTON);
  });

  it('says "check" for one', () => {
    expect(draw(['csp'])).toMatch(RUN_ONE_CHECK_BUTTON);
  });

  it('can be pressed while there are checks to run', () => {
    expect(draw(['csp'])).not.toMatch(DISABLED_BUTTON);
  });

  it('cannot be pressed when no checks are chosen', () => {
    expect(draw([])).toMatch(RUN_ZERO_CHECKS_BUTTON);
  });

  it('says nothing about saving before a scan', () => {
    const out = draw(['csp']);
    expect(out).not.toContain('Saving the report');
    expect(out).not.toContain('Report saved.');
  });

  it('shows no results before a scan', () => {
    expect(draw(['csp'])).not.toContain('Results for');
  });

  it('names the site on the left and puts the actions beside the button', () => {
    const out = htmlAt(
      <SiteRunner
        domainId="d1"
        host="example.com"
        checks={['csp']}
        identity={<span>the site</span>}
        actions={<a href="/settings">Checks</a>}
      />,
    );
    expect(out).toContain('the site');
    expect(out.indexOf('Checks')).toBeLessThan(out.indexOf('Run 1 check'));
  });

  it('shows the saved report when no run is under way', () => {
    const out = htmlAt(
      <SiteRunner
        domainId="d1"
        host="example.com"
        checks={['csp']}
        identity={<span>who</span>}
        saved={<p>the report</p>}
      />,
    );
    expect(out).toContain('the report');
  });
});
