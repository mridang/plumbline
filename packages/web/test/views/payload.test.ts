import { describe, expect, it } from '@jest/globals';

import {
  NO_DATA_MESSAGE,
  isDomainListData,
  isReportData,
  readOutcome,
  textOf,
} from '@/views/payload';

/** A report payload the server would send. */
const CARD = {
  host: 'example.com',
  url: 'https://example.com/',
  created_at: '2026-10-01T00:00:00.000Z',
  link: 'https://plumbline.apps.mrida.ng/domains/d1',
  passed: 3,
  warned: 1,
  failed: 1,
  skipped: 0,
  problems: [
    {
      id: 'csp-header',
      name: 'Content-Security-Policy is set',
      status: 'failed',
      findings: [{ message: 'No CSP.', resource: 'https://example.com/' }],
    },
  ],
};

/** A domain list payload the server would send. */
const LIST = {
  total_checks: 300,
  link: 'https://plumbline.apps.mrida.ng/domains',
  domains: [
    {
      id: 'd1',
      host: 'example.com',
      checks: 300,
      latest: {
        passed: 1,
        warned: 0,
        failed: 0,
        skipped: 0,
        created_at: '2026-10-01T00:00:00.000Z',
      },
    },
  ],
};

describe('isReportData', () => {
  it('accepts what the server sends', () => {
    expect(isReportData(CARD)).toBe(true);
  });

  it('accepts a report with nothing wrong', () => {
    expect(isReportData({ ...CARD, problems: [] })).toBe(true);
  });

  it.each([
    ['no problems list', { ...CARD, problems: undefined }],
    ['a host that is not text', { ...CARD, host: 7 }],
    ['a negative count', { ...CARD, failed: -1 }],
    ['a count that is not whole', { ...CARD, passed: 1.5 }],
    ['a missing count', { ...CARD, skipped: undefined }],
    [
      'a problem that passed',
      { ...CARD, problems: [{ ...CARD.problems[0], status: 'passed' }] },
    ],
    [
      'a finding without a resource',
      {
        ...CARD,
        problems: [{ ...CARD.problems[0], findings: [{ message: 'x' }] }],
      },
    ],
    ['null', null],
    ['text', 'text'],
  ])('refuses %s', (_label, value) => {
    expect(isReportData(value)).toBe(false);
  });
});

describe('isDomainListData', () => {
  it('accepts a list, empty or not', () => {
    expect(isDomainListData(LIST)).toBe(true);
    expect(isDomainListData({ ...LIST, domains: [] })).toBe(true);
  });

  it('accepts a domain that has not been scanned', () => {
    expect(
      isDomainListData({
        ...LIST,
        domains: [{ id: 'd1', host: 'example.com', checks: 3 }],
      }),
    ).toBe(true);
  });

  it.each([
    ['an entry without a host', { ...LIST, domains: [{ id: '1', checks: 1 }] }],
    [
      'an entry whose latest scan has no counts',
      { ...LIST, domains: [{ id: '1', host: 'a.com', checks: 1, latest: {} }] },
    ],
    ['domains that are not a list', { ...LIST, domains: 'many' }],
    ['no link', { ...LIST, link: undefined }],
    ['no total', { ...LIST, total_checks: undefined }],
    ['undefined', undefined],
  ])('refuses %s', (_label, value) => {
    expect(isDomainListData(value)).toBe(false);
  });
});

describe('textOf', () => {
  it('joins the text blocks and skips everything else', () => {
    expect(
      textOf([
        { type: 'text', text: 'one' },
        { type: 'image', data: 'x' },
        { type: 'text', text: 'two' },
        null,
        { type: 'text', text: 3 },
      ]),
    ).toBe('one\n\ntwo');
  });

  it('is empty for no content', () => {
    expect(textOf(undefined)).toBe('');
    expect(textOf([])).toBe('');
  });
});

describe('readOutcome', () => {
  it('returns the data when the result carries it', () => {
    expect(
      readOutcome({ structuredContent: CARD, content: [] }, isReportData),
    ).toEqual({ kind: 'data', data: CARD });
  });

  it('turns an error result into its message, not a loading state', () => {
    expect(
      readOutcome(
        {
          isError: true,
          content: [
            { type: 'text', text: 'example.com has not been scanned yet.' },
          ],
        },
        isReportData,
      ),
    ).toEqual({
      kind: 'message',
      text: 'example.com has not been scanned yet.',
      isError: true,
    });
  });

  it('does not trust data in a result that is flagged as an error', () => {
    expect(
      readOutcome(
        { isError: true, structuredContent: CARD, content: [] },
        isReportData,
      ),
    ).toMatchObject({ kind: 'message', isError: true });
  });

  it('shows the text of a result without structured content, as a note', () => {
    expect(
      readOutcome(
        { content: [{ type: 'text', text: 'Nothing saved yet.' }] },
        isDomainListData,
      ),
    ).toEqual({ kind: 'message', text: 'Nothing saved yet.', isError: false });
  });

  it('treats data of the wrong shape as a message too', () => {
    expect(
      readOutcome({ structuredContent: { domains: 5 } }, isDomainListData),
    ).toMatchObject({ kind: 'message', text: NO_DATA_MESSAGE });
  });
});
