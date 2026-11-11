import { describe, expect, it } from '@jest/globals';

import { findCheck } from '@/domain/checks/catalogue';
import type { Comparison } from '@/domain/suite/baseline';
import type { StoredFinding } from '@/domain/suite/diff';
import {
  MAX_LISTED,
  MAX_PROBLEMS,
  MAX_PROBLEM_LENGTH,
  MAX_TEXT,
  breakdown,
  dataBlock,
  MAX_DATA,
  SUMMARY_LISTED,
  checkRunOutput,
  conclusionOf,
  conclusionOfReport,
  countsOf,
  MAX_ISSUE_FINDINGS,
  backComment,
  changedComment,
  checkIssueText,
  closingComment,
  deferredComment,
  issueMarker,
  leftClosedComment,
  offSnippet,
  reopenedComment,
  replacedComment,
  reportedFindings,
  safeText,
} from '@/domain/suite/report';

const found = (
  severity: StoredFinding['severity'],
  message = 'm',
  id = 'seo-viewport',
): StoredFinding => ({ id, severity, message });

describe('countsOf and conclusionOf', () => {
  it('counts each severity', () => {
    expect(
      countsOf([
        found('error'),
        found('hint'),
        found('hint'),
        found('warning'),
      ]),
    ).toEqual({ errors: 1, warnings: 1, hints: 2 });
  });

  it('fails on an error, is neutral on a warning, and passes otherwise', () => {
    expect(conclusionOf([found('warning'), found('error')])).toBe('failure');
    expect(conclusionOf([found('warning'), found('hint')])).toBe('neutral');
    expect(conclusionOf([found('hint')])).toBe('success');
    expect(conclusionOf([])).toBe('success');
  });
});

describe('reportedFindings', () => {
  const all = [found('error', 'e'), found('warning', 'w'), found('hint', 'h')];

  it('keeps the errors at the level error', () => {
    expect(reportedFindings(all, 'error').map((f) => f.message)).toEqual(['e']);
  });

  it('keeps errors and warnings at the level warning', () => {
    expect(reportedFindings(all, 'warning').map((f) => f.message)).toEqual([
      'e',
      'w',
    ]);
  });

  it('keeps nothing when issues are off', () => {
    expect(reportedFindings(all, 'off')).toEqual([]);
  });
});

describe('breakdown', () => {
  it('groups by rule under the rule name, with the worst rules first', () => {
    const text = breakdown([
      found('warning', 'w1', 'seo-links'),
      found('error', 'e1', 'seo-viewport'),
      found('hint', 'h1', 'seo-links'),
    ]);
    const viewport = findCheck('seo-viewport')?.name ?? '';
    const links = findCheck('seo-links')?.name ?? '';
    expect(viewport).not.toBe('');
    expect(text.indexOf(viewport)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(viewport)).toBeLessThan(text.indexOf(links));
    expect(text).toContain('(`seo-viewport`)');
    expect(text.indexOf('**warning**: w1')).toBeLessThan(
      text.indexOf('**hint**: h1'),
    );
  });

  it('links to the reference of a rule that has one', () => {
    const reference = findCheck('seo-viewport')?.reference;
    expect(reference).toBeDefined();
    expect(breakdown([found('error')])).toContain(`](${reference})`);
  });

  it('uses the id for a rule it does not know', () => {
    expect(breakdown([found('error', 'm', 'mystery')])).toContain(
      '#### mystery (`mystery`)',
    );
  });

  it('writes out no more than the limit and counts the rest', () => {
    const many = Array.from({ length: MAX_LISTED + 5 }, (_, i) =>
      found('warning', `problem ${i}`),
    );
    const text = breakdown(many);
    expect(text).toContain(`problem ${MAX_LISTED - 1}`);
    expect(text).not.toContain(`problem ${MAX_LISTED}\n`);
    expect(text).toContain('...and 5 more.');
  });
});

describe('checkRunOutput', () => {
  const base = {
    url: 'https://pr-3.site.test/',
    source: 'plumbline.yaml',
    problems: [],
  };

  it('says nothing was found when it was not', () => {
    const out = checkRunOutput({ ...base, findings: [] });
    expect(out.title).toBe('No problems found on pr-3.site.test');
    expect(out.summary).toContain('Checked https://pr-3.site.test/');
  });

  it('counts what was found in the title and lists it in the summary', () => {
    const out = checkRunOutput({
      ...base,
      findings: [found('error', 'no viewport'), found('hint', 'fyi')],
    });
    expect(out.title).toBe('1 error, 0 warnings and 1 hint on pr-3.site.test');
    expect(out.summary).toContain('**error**: no viewport');
  });

  it('names the file the rules came from, or says there is none', () => {
    expect(checkRunOutput({ ...base, findings: [] }).summary).toContain(
      'Rules from `plumbline.yaml`.',
    );
    expect(
      checkRunOutput({ ...base, source: null, findings: [] }).summary,
    ).toContain('`plumbline:recommended` rules were used');
  });

  it('lists the problems in the configuration', () => {
    const summary = checkRunOutput({
      ...base,
      problems: ['Unknown rule "x" in plumbline.yaml.'],
      findings: [],
    }).summary;
    expect(summary).toContain('Problems in the configuration:');
    expect(summary).toContain('- Unknown rule "x" in plumbline.yaml.');
  });
});

describe('checkRunOutput, short for people and complete for tools', () => {
  const base = {
    url: 'https://pr-3.site.test/',
    source: null,
    problems: [],
    reportUrl: 'https://plumbline.test/r/abc',
    dataUrl: 'https://plumbline.test/r/abc/json',
  };
  const many = Array.from({ length: SUMMARY_LISTED + 4 }, (_, i) =>
    found('warning', `problem ${i}`),
  );

  it('links the report in the summary', () => {
    expect(checkRunOutput({ ...base, findings: [] }).summary).toContain(
      '[Open the full report](https://plumbline.test/r/abc)',
    );
  });

  it('lists only the worst few findings in the summary and counts the rest', () => {
    const { summary } = checkRunOutput({
      ...base,
      findings: [...many, found('error', 'the worst')],
    });
    expect(summary).toContain('**error**: the worst');
    expect(summary).toContain('...and 5 more in the report.');
    expect(summary).not.toContain(`problem ${SUMMARY_LISTED + 3}`);
  });

  it('puts every finding in the text, with the data a tool can read', () => {
    const { text } = checkRunOutput({ ...base, findings: many });
    expect(text).toContain(`problem ${SUMMARY_LISTED + 3}`);
    expect(text).toContain('```json');
  });

  it('says nothing was found in the text when it was not', () => {
    expect(checkRunOutput({ ...base, findings: [] }).text).toContain(
      'Nothing found.',
    );
  });
});

describe('dataBlock', () => {
  const base = {
    url: 'https://pr-3.site.test/',
    source: null,
    problems: [],
    reportUrl: 'https://plumbline.test/r/abc',
    dataUrl: 'https://plumbline.test/r/abc/json',
  };
  const parse = (block: string): Record<string, unknown> =>
    JSON.parse(block.replace(/^```json\n/, '').replace(/\n```$/, ''));

  it('is JSON with the counts, the links and each finding with its rule name', () => {
    const data = parse(
      dataBlock({ ...base, findings: [found('error', 'no viewport')] }),
    );
    expect(data).toMatchObject({
      version: 1,
      conclusion: 'failure',
      errors: 1,
      report: 'https://plumbline.test/r/abc',
      json: 'https://plumbline.test/r/abc/json',
      truncated: false,
      findings: [
        { id: 'seo-viewport', severity: 'error', message: 'no viewport' },
      ],
    });
  });

  it('cannot be broken out of by a message that holds a code fence', () => {
    const block = dataBlock({
      ...base,
      findings: [found('error', 'a ``` b')],
    });
    expect(block.slice(7, -4)).not.toContain('`');
    expect(parse(block)['findings']).toMatchObject([{ message: 'a ``` b' }]);
  });

  it('stays valid JSON when there are more findings than it carries', () => {
    const data = parse(
      dataBlock({
        ...base,
        findings: Array.from({ length: MAX_DATA + 3 }, () => found('hint')),
      }),
    );
    expect(data['truncated']).toBe(true);
    expect(data['findings']).toHaveLength(MAX_DATA);
  });
});

describe('checkIssueText', () => {
  const input = {
    repo: 'acme/site',
    host: 'site.test',
    url: 'https://site.test/',
    sha: 'abcdef123456',
    check: 'seo-viewport',
    findings: [found('error', 'e'), found('warning', 'w')],
    source: null,
  };

  it('is titled with the check and the site', () => {
    expect(checkIssueText(input).title).toBe(
      `[Plumbline] ${findCheck('seo-viewport')?.name} on site.test`,
    );
  });

  it('starts with the marker of the check on the site, and names the commit', () => {
    const { body } = checkIssueText(input);
    expect(body.startsWith(issueMarker('site.test', 'seo-viewport'))).toBe(
      true,
    );
    expect(body).toContain('at commit `abcdef1`');
    expect(body).toContain('**error**: e');
  });

  it('leaves the commit out when there is none', () => {
    expect(checkIssueText({ ...input, sha: null }).body).not.toContain(
      'at commit',
    );
  });

  it('tells how to fix it, with the reference when the check has one', () => {
    const { body } = checkIssueText(input);
    expect(body).toContain('### How to fix');
    const reference = findCheck('seo-viewport')?.reference;
    if (reference) {
      expect(body).toContain(`[Why it matters](${reference})`);
    }
  });

  it('shows the exact lines that turn the check off, and says the next deployment closes the issue', () => {
    const { body } = checkIssueText(input);
    expect(body).toContain('### Not needed?');
    expect(body).toContain(offSnippet('seo-viewport'));
    expect(offSnippet('seo-viewport')).toBe(
      '```yaml\nrules:\n  seo-viewport: off\n```',
    );
    expect(body).toContain('`plumbline.yaml`');
    expect(body).toContain('closes this issue by itself');
  });

  it('links the rules file when the rules came from one, at the commit', () => {
    const { body } = checkIssueText({ ...input, source: 'plumbline.yml' });
    expect(body).toContain(
      '[`plumbline.yml`](https://github.com/acme/site/blob/abcdef123456/plumbline.yml)',
    );
  });

  it('links the results when it is told where they are', () => {
    expect(
      checkIssueText({ ...input, pageUrl: 'https://app.test/repos/acme/site' })
        .body,
    ).toContain('[Open the results](https://app.test/repos/acme/site)');
    expect(checkIssueText(input).body).not.toContain('Open the results');
  });

  it('lists the worst findings first, no more than the limit, and counts the rest', () => {
    const many = Array.from({ length: MAX_ISSUE_FINDINGS + 3 }, (_, i) =>
      found('error', `problem ${i}`),
    );
    const { body } = checkIssueText({
      ...input,
      findings: [found('warning', 'mild'), ...many],
    });
    expect(body).toContain('...and 4 more.');
    expect(body.indexOf('problem 0')).toBeGreaterThan(-1);
    expect(body).not.toContain('mild');
  });

  it('cannot mention a user or make a link from what the site said', () => {
    const { body } = checkIssueText({
      ...input,
      findings: [found('error', 'ping @someone see https://evil.test #1')],
    });
    expect(body).not.toContain('@someone');
    expect(body).not.toContain('https://evil.test');
  });

  it('never goes past what GitHub accepts, and falls back to the id for a check it does not know', () => {
    const { title, body } = checkIssueText({
      ...input,
      check: 'no-such-check',
      source: 'x'.repeat(MAX_TEXT),
    });
    expect(body.length).toBeLessThanOrEqual(MAX_TEXT + 20);
    expect(title).toBe('[Plumbline] no-such-check on site.test');
  });
});

describe('the comments the app makes', () => {
  const where = {
    repo: 'acme/site',
    host: 'site.test',
    source: null,
    sha: 'abcdef123456',
    where: '#4 (commit `abcdef1`)',
  };

  it.each([
    ['fixed', 'no longer finds this problem as of #4'],
    ['off', 'turned off by the rules in `plumbline.yaml`'],
    ['level', 'no longer opens an issue under the rules'],
    ['removed', 'no longer has this check'],
    ['undeployed', 'site.test is no longer deployed from this repository'],
    ['disabled', 'Checks for this repository were turned off in Plumbline'],
    ['config', 'turned off in `plumbline.yaml` (`enabled: false`)'],
  ] as const)('says why it closed an issue: %s', (reason, text) => {
    expect(closingComment(reason, where)).toContain(text);
  });

  it('links the rules file in a closing comment when there is one', () => {
    expect(
      closingComment('off', { ...where, source: 'plumbline.yaml' }),
    ).toContain('blob/abcdef123456/plumbline.yaml');
  });

  it('asks not to close the issue and shows how to turn the check off instead', () => {
    const text = reopenedComment('seo-viewport', 'site.test');
    expect(text).toContain('Please do not close this issue');
    expect(text).toContain(offSnippet('seo-viewport'));
    expect(text).toContain('closes this issue by itself');
  });

  it('says it stops reopening, and that the problem stays reported', () => {
    const text = leftClosedComment('seo-viewport');
    expect(text).toContain('will not reopen it');
    expect(text).toContain('still reported in Plumbline');
    expect(text).toContain(offSnippet('seo-viewport'));
  });

  it('counts the problems that found no room', () => {
    expect(deferredComment(1)).toContain('1 more problem than');
    expect(deferredComment(3)).toContain('3 more problems than');
  });

  it('says a problem is back, or changed, and that the issue was replaced', () => {
    expect(backComment('#4')).toContain('back as of #4');
    expect(changedComment('#4')).toContain('different problem as of #4');
    expect(replacedComment()).toContain('one issue for each check');
  });
});

describe('safeText', () => {
  it('keeps ordinary text as it is', () => {
    expect(safeText('Unknown rule "seo-nope" in plumbline.yaml.')).toBe(
      'Unknown rule "seo-nope" in plumbline.yaml.',
    );
  });

  it('cannot mention a user or a team, or refer to an issue', () => {
    const text = safeText('@acme/team and @someone, see #12');
    expect(text).not.toMatch(/@[a-z]/);
    expect(text).not.toMatch(/#\d/);
  });

  it('cannot make a link, an image, a tag or a code span', () => {
    const text = safeText(
      '[login](https://evil.test) <img src=x> `code` http://x.test',
    );
    expect(text).not.toMatch(/[<>[\]`]/);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('cannot start a new line or block', () => {
    const text = safeText('a\n\n# heading\r\n- item\u0000');
    expect([...text].filter((char) => char.charCodeAt(0) < 32)).toEqual([]);
  });

  it('is no longer than a sentence', () => {
    const text = safeText('x'.repeat(MAX_PROBLEM_LENGTH * 3));
    expect(text).toHaveLength(MAX_PROBLEM_LENGTH + 3);
    expect(text.endsWith('...')).toBe(true);
  });
});

describe('what a hostile configuration can make the text hold', () => {
  const base = {
    url: 'https://pr-3.site.test/',
    source: 'plumbline.yaml',
    findings: [],
  };

  it('is made safe line by line', () => {
    const { summary } = checkRunOutput({
      ...base,
      problems: [
        'Unknown rule "@acme/team [x](https://evil.test)" in plumbline.yaml.',
      ],
    });
    expect(summary).not.toMatch(/@[a-z]/);
    expect(summary).not.toContain('](https://');
  });

  it('is cut to a number of problems, and the rest counted', () => {
    const { summary } = checkRunOutput({
      ...base,
      problems: Array.from(
        { length: MAX_PROBLEMS + 5 },
        (_, i) => `problem ${i}`,
      ),
    });
    expect(summary).toContain(`problem ${MAX_PROBLEMS - 1}`);
    expect(summary).not.toContain(`problem ${MAX_PROBLEMS}\n`);
    expect(summary).toContain('...and 5 more.');
  });

  it('never goes past what GitHub accepts in a summary', () => {
    const findings = Array.from({ length: MAX_LISTED }, (_, i) =>
      found('error', 'x'.repeat(5000) + i),
    );
    const out = checkRunOutput({ ...base, findings, problems: [] });
    expect(out.summary.length).toBeLessThanOrEqual(MAX_TEXT + 20);
  });
});

describe('a report compared with the live site', () => {
  const compared = (over: Partial<Comparison> = {}): Comparison => ({
    host: 'live.example.com',
    added: [],
    existing: [],
    fixed: [],
    uncompared: [],
    ...over,
  });
  const report = (comparison: Comparison, findings: StoredFinding[] = []) => ({
    url: 'https://pr-3.example.com/',
    findings,
    source: null,
    problems: [],
    comparison,
  });

  it('ends on the comparison when there is one, and on the findings alone when there is none', () => {
    const findings = [found('error')];
    expect(conclusionOfReport({ findings })).toBe('failure');
    expect(
      conclusionOfReport({
        findings,
        comparison: compared({ existing: findings }),
      }),
    ).toBe('success');
    expect(
      conclusionOfReport({
        findings,
        comparison: compared({ added: findings }),
      }),
    ).toBe('failure');
  });

  it('says there is nothing new, and how many problems were already there', () => {
    const old = [found('error', 'a', 'seo-viewport'), found('warning', 'b')];
    const out = checkRunOutput(report(compared({ existing: old }), old));
    expect(out.title).toBe(
      'No new problems on pr-3.example.com (2 already on live.example.com)',
    );
    expect(out.summary).toContain(
      'Compared with the latest check of live.example.com: 2 existing issues, none new.',
    );
    expect(out.summary).toContain(
      'Only problems this change adds fail the check.',
    );
  });

  it('puts the new errors first and fails the title on them', () => {
    const added = [found('warning', 'w'), found('error', 'e')];
    const out = checkRunOutput(
      report(compared({ added, existing: [found('error', 'old')] }), [
        ...added,
        found('error', 'old'),
      ]),
    );
    expect(out.title).toBe('1 new error on pr-3.example.com');
    expect(out.summary).toContain('1 existing issue, 2 new');
    expect(out.summary.indexOf('**new error**: e')).toBeLessThan(
      out.summary.indexOf('**new warning**: w'),
    );
  });

  it('titles a change that adds only warnings by them', () => {
    const added = [found('warning', 'w1'), found('warning', 'w2')];
    expect(checkRunOutput(report(compared({ added }), added)).title).toBe(
      '2 new warnings on pr-3.example.com',
    );
  });

  it('says plainly that nothing is wrong when nothing is', () => {
    expect(checkRunOutput(report(compared())).title).toBe(
      'No problems found on pr-3.example.com',
    );
  });

  it('names what the change fixed', () => {
    const out = checkRunOutput(
      report(compared({ fixed: [found('error', 'x', 'seo-viewport')] })),
    );
    expect(out.summary).toContain('1 fixed');
    expect(out.summary).toContain(
      `Fixed by this change: ${findCheck('seo-viewport')?.name}.`,
    );
  });

  it('says which findings could not be compared and why', () => {
    const out = checkRunOutput(
      report(compared({ uncompared: [found('error', 'x', 'seo-viewport')] })),
    );
    expect(out.summary).toContain(
      '1 finding could not be compared, because live.example.com does not run those checks.',
    );
  });

  it('cuts the list of new problems and counts the rest', () => {
    const added = Array.from({ length: SUMMARY_LISTED + 2 }, (_, i) =>
      found('error', `e${i}`),
    );
    const out = checkRunOutput(report(compared({ added }), added));
    expect(out.summary).toContain('...and 2 more new in the report.');
  });

  it('tells a tool the same in the data block', () => {
    const added = [found('error', 'e')];
    const block = dataBlock(
      report(compared({ added, existing: [found('warning', 'w')] }), added),
    );
    expect(block).toContain('"conclusion": "failure"');
    expect(block).toContain('"site": "live.example.com"');
    expect(block).toContain('"new": 1');
    expect(block).toContain('"existing": 1');
  });

  it('leaves the baseline out of the data block when there is none', () => {
    expect(
      dataBlock({
        url: 'https://pr-3.example.com/',
        findings: [],
        source: null,
        problems: [],
      }),
    ).not.toContain('baseline');
  });
});
