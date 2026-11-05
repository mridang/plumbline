import { describe, expect, it } from '@jest/globals';

import {
  furtherReading,
  HintRow,
  isWebLink,
  issueUrl,
  placeOf,
} from '@/components/scan/hint-row';
import type { IssueRef } from '@/domain/db/issue-history';
import type { Finding, HintOutcome } from '@/domain/scan/outcome';
import { html } from '../render';

/** A check with the given outcome. */
const hint = (
  status: HintOutcome['status'],
  extra: Partial<HintOutcome> = {},
): HintOutcome => ({
  id: 'hsts-header',
  name: 'HSTS is set',
  description: 'Looks for Strict-Transport-Security.',
  section: 'transport',
  sectionTitle: 'Transport',
  sectionOrder: 1,
  groups: [],
  origins: [],
  status,
  findings: [],
  ...extra,
});

/** A `<details>` that starts open. */
const OPEN = /<details[^>]* open=""/;

/** A finding on example.com. */
const finding = (extra: Partial<Finding> = {}): Finding => ({
  resource: 'https://example.com/',
  message: 'No HSTS header.',
  level: 'error',
  ...extra,
});

describe('isWebLink', () => {
  it('takes http and https addresses', () => {
    expect(isWebLink('https://example.com/')).toBe(true);
    expect(isWebLink('HTTP://example.com/')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isWebLink('javascript:alert(1)')).toBe(false);
    expect(isWebLink('example.com')).toBe(false);
    expect(isWebLink('dns:example.com')).toBe(false);
  });
});

describe('placeOf', () => {
  it('adds the line and the column when both are known', () => {
    expect(placeOf(finding({ line: 3, column: 7 }))).toBe(
      'https://example.com/:3:7',
    );
  });

  it('adds the line alone when the column is not known', () => {
    expect(placeOf(finding({ line: 3 }))).toBe('https://example.com/:3');
  });

  it('is the resource alone without a line', () => {
    expect(placeOf(finding({ column: 7 }))).toBe('https://example.com/');
  });
});

describe('furtherReading', () => {
  it('lists each address once, in the order the findings give them', () => {
    expect(
      furtherReading([
        finding({ links: [{ url: 'https://a.test/', text: 'A' }] }),
        finding({
          links: [
            { url: 'https://b.test/', text: 'B' },
            { url: 'https://a.test/', text: 'A again' },
          ],
        }),
      ]),
    ).toEqual([
      { url: 'https://a.test/', text: 'A' },
      { url: 'https://b.test/', text: 'B' },
    ]);
  });

  it('drops links that are not web links, and is empty without any', () => {
    expect(
      furtherReading([
        finding({ links: [{ url: 'javascript:x', text: 'x' }] }),
        finding(),
      ]),
    ).toEqual([]);
  });
});

describe('HintRow', () => {
  it('starts open when the check failed', () => {
    expect(html(<HintRow hint={hint('failed')} />)).toMatch(OPEN);
  });

  it.each(['warned', 'passed', 'skipped'] as const)(
    'starts closed when the check %s',
    (status) => {
      expect(html(<HintRow hint={hint(status)} />)).not.toMatch(OPEN);
    },
  );

  it('is open or closed as the caller says, whatever the outcome', () => {
    expect(html(<HintRow hint={hint('passed')} open />)).toMatch(OPEN);
    expect(html(<HintRow hint={hint('failed')} open={false} />)).not.toMatch(
      OPEN,
    );
  });

  it('shows the check’s id next to its name', () => {
    expect(html(<HintRow hint={hint('passed')} />)).toContain(
      '>hsts-header</code>',
    );
  });

  it('lists what was found with its level, place and evidence', () => {
    const out = html(
      <HintRow
        hint={hint('failed', {
          findings: [
            finding({
              line: 2,
              snippet: 'Strict-Transport-Security: max-age=0',
              language: 'http',
            }),
          ],
        })}
      />,
    );
    expect(out).toContain('What was found');
    expect(out).toContain('>error</span>No HSTS header.');
    expect(out).toContain(
      'href="https://example.com/" class="focus-ring break-all text-accent underline">https://example.com/:2</a>',
    );
    expect(out).toContain('Evidence (http)');
    expect(out).toContain('Strict-Transport-Security: max-age=0</pre>');
  });

  it('shows a resource that is not a web link as text', () => {
    const out = html(
      <HintRow
        hint={hint('failed', {
          findings: [finding({ resource: 'dns:example.com' })],
        })}
      />,
    );
    expect(out).toContain('dns:example.com');
    expect(out).not.toContain('href="dns:example.com"');
  });

  it('says how to fix a problem: who fixes it and what the evidence shows', () => {
    const out = html(
      <HintRow
        hint={hint('failed', {
          fixer: 'web server or CDN TLS config',
          findings: [finding({ snippet: 'Strict-Transport-Security: …' })],
        })}
      />,
    );
    expect(out).toContain('How to fix');
    expect(out).toContain('web server or CDN TLS config');
    expect(out).toContain('The evidence above shows what is at fault');
  });

  it('leaves out the line on the evidence when no finding has any', () => {
    const out = html(
      <HintRow
        hint={hint('warned', {
          fixer: 'DNS zone',
          findings: [finding({ level: 'warning' })],
        })}
      />,
    );
    expect(out).toContain('DNS zone');
    expect(out).not.toContain('The evidence above');
  });

  it('calls the panel “About this rule” for a check that passed, without who fixes it', () => {
    const out = html(
      <HintRow
        hint={hint('passed', {
          fixer: 'web server or CDN TLS config',
          reference: 'https://example.org/rule',
        })}
      />,
    );
    expect(out).toContain('About this rule');
    expect(out).not.toContain('How to fix');
    expect(out).not.toContain('web server or CDN TLS config');
    expect(out).toContain('href="https://example.org/rule"');
  });

  it('draws no panel when there is nothing to say', () => {
    const out = html(<HintRow hint={hint('passed')} />);
    expect(out).not.toContain('About this rule');
    expect(out).not.toContain('How to fix');
  });

  it('lists the further reading the findings gave', () => {
    const out = html(
      <HintRow
        hint={hint('failed', {
          findings: [
            finding({ links: [{ url: 'https://fix.test/', text: 'The fix' }] }),
          ],
        })}
      />,
    );
    expect(out).toContain('Further reading');
    expect(out).toContain('href="https://fix.test/"');
    expect(out).toContain('>The fix</a>');
  });

  it('says where the check comes from, with the upstream docs and summary', () => {
    const out = html(
      <HintRow
        hint={hint('passed', {
          origins: [
            {
              source: 'observatory',
              title: 'HSTS',
              url: 'https://upstream.test/hsts',
              docsUrl: 'https://upstream.test/docs',
              summary: 'Checks the HSTS header.',
            },
          ],
        })}
      />,
    );
    expect(out).toContain('Where this check comes from');
    expect(out).toContain('observatory');
    expect(out).toContain('href="https://upstream.test/hsts"');
    expect(out).toContain('href="https://upstream.test/docs"');
    expect(out).toContain('Checks the HSTS header.');
  });

  it('shows an origin’s docs only when they are a web link', () => {
    const out = html(
      <HintRow
        hint={hint('passed', {
          origins: [
            {
              source: 'owasp',
              title: 'HSTS',
              url: 'https://upstream.test/hsts',
              docsUrl: 'javascript:x',
              summary: '',
            },
          ],
        })}
      />,
    );
    expect(out).not.toContain('>docs</');
  });

  it('lists the groups the check belongs to', () => {
    const out = html(
      <HintRow hint={hint('passed', { groups: ['observatory', 'tls'] })} />,
    );
    expect(out).toContain('aria-label="Groups"');
    expect(out).toContain('>observatory</li>');
    expect(out).toContain('>tls</li>');
  });

  it('says why a check was skipped', () => {
    expect(
      html(<HintRow hint={hint('skipped', { reason: 'Needs a server' })} />),
    ).toContain('Needs a server');
  });
});

describe('the GitHub issues of a check', () => {
  const issue = (
    number: number,
    state: IssueRef['state'],
    opened_at = '2026-01-01T00:00:00.000Z',
  ): IssueRef => ({ number, state, opened_at, checks: ['hsts-header'] });

  it('builds the address of an issue from the repository', () => {
    expect(issueUrl('acme/site', issue(12, 'open'))).toBe(
      'https://github.com/acme/site/issues/12',
    );
  });

  it('lists each issue as a link with its state and when it was opened', () => {
    const out = html(
      <HintRow
        hint={hint('failed')}
        repository="acme/site"
        issues={[issue(12, 'open'), issue(9, 'fixed'), issue(4, 'dismissed')]}
      />,
    );
    expect(out).toContain('GitHub issues');
    expect(out).toContain('href="https://github.com/acme/site/issues/12"');
    expect(out).toContain('href="https://github.com/acme/site/issues/9"');
    expect(out).toContain('Open</span>');
    expect(out).toContain('Closed — fixed</span>');
    expect(out).toContain('Closed by a person</span>');
    expect(out).toMatch(/<time[^>]*dateTime="2026-01-01T00:00:00.000Z"/);
  });

  it('counts them in the summary, naming the issue when there is one', () => {
    const one = html(
      <HintRow
        hint={hint('passed')}
        repository="acme/site"
        issues={[issue(12, 'open')]}
      />,
    );
    expect(one).toContain('Issue #12');
    const two = html(
      <HintRow
        hint={hint('passed')}
        repository="acme/site"
        issues={[issue(12, 'open'), issue(9, 'fixed')]}
      />,
    );
    expect(two).toContain('2 issues');
  });

  it('shows nothing about issues for a check no issue reported, or with no repository', () => {
    expect(
      html(<HintRow hint={hint('failed')} repository="acme/site" />),
    ).not.toContain('GitHub issues');
    expect(
      html(<HintRow hint={hint('failed')} issues={[issue(12, 'open')]} />),
    ).not.toContain('GitHub issues');
  });
});
