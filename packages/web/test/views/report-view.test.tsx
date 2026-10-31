import { describe, expect, it } from '@jest/globals';

import type { ReportData } from '@/domain/mcp/ui-types';
import { ReportApp, ReportCard, ReportScreen } from '@/views/report-view';
import type { ViewState } from '@/views/view-state';
import { html } from '../components/render';

const REPORT: ReportData = {
  host: 'example.com',
  url: 'https://example.com/',
  created_at: '2026-10-01T12:00:00.000Z',
  link: 'https://plumbline.apps.mrida.ng/domains/d1',
  passed: 12,
  warned: 2,
  failed: 1,
  skipped: 3,
  problems: [
    {
      id: 'csp-header',
      name: 'Content-Security-Policy is set',
      status: 'failed',
      findings: [
        {
          message: 'No Content-Security-Policy header.',
          resource: 'https://example.com/',
          snippet: 'Content-Security-Policy: default-src self',
        },
      ],
    },
    {
      id: 'hsts',
      name: 'HSTS is long enough',
      status: 'warned',
      findings: [
        { message: 'max-age is short.', resource: 'https://example.com/' },
      ],
    },
  ],
};

/** Render the card with or without a way to open links. */
function card(data: ReportData = REPORT, canOpenLinks = true): string {
  return html(
    <ReportCard
      data={data}
      onOpenLink={canOpenLinks ? () => undefined : undefined}
    />,
  );
}

/** Render the screen for a state. */
function screen(state: ViewState<ReportData>): string {
  return html(<ReportScreen state={state} onOpenLink={undefined} />);
}

describe('ReportCard', () => {
  it('names the domain as the heading', () => {
    expect(card()).toContain('<h1 class="title">example.com</h1>');
  });

  it('shows the four counts', () => {
    const out = card();
    expect(out).toContain('<li class="failed">1 failed</li>');
    expect(out).toContain('<li class="warned">2 warned</li>');
    expect(out).toContain('<li class="passed">12 passed</li>');
    expect(out).toContain('<li>3 skipped</li>');
  });

  it('labels the counts for screen readers', () => {
    expect(card()).toContain('aria-label="Results"');
  });

  it('lists each problem with its status', () => {
    const out = card();
    expect(out).toContain('<span class="status failed">failed</span>');
    expect(out).toContain('<span class="status warned">warned</span>');
    expect(out).toContain('Content-Security-Policy is set');
  });

  it('folds each problem so the list stays short', () => {
    expect(card().match(/<details>/g)).toHaveLength(2);
  });

  it('shows what a check found and where', () => {
    const out = card();
    expect(out).toContain('<p>No Content-Security-Policy header.</p>');
    expect(out).toContain('<span class="where">https://example.com/</span>');
  });

  it('shows the evidence of a finding that has some', () => {
    expect(card()).toContain(
      '<pre>Content-Security-Policy: default-src self</pre>',
    );
  });

  it('draws no evidence block for a finding without any', () => {
    expect(card().match(/<pre>/g)).toHaveLength(1);
  });

  it('draws text from the scanned site as text, never as markup', () => {
    const hostile: ReportData = {
      ...REPORT,
      problems: [
        {
          id: 'x',
          name: '<img src=x onerror=alert(1)>',
          status: 'failed',
          findings: [],
        },
      ],
    };
    expect(card(hostile)).not.toContain('<img');
  });

  it('says so when nothing failed or warned', () => {
    expect(card({ ...REPORT, problems: [] })).toContain(
      'Nothing failed or warned.',
    );
  });

  it('offers to open the domain in plumbline when the host can open links', () => {
    expect(card()).toContain('Open in plumbline');
  });

  it('offers no link when the host cannot open one', () => {
    expect(card(REPORT, false)).not.toContain('Open in plumbline');
  });

  it('offers no link that is not a web address', () => {
    expect(card({ ...REPORT, link: 'javascript:alert(1)' })).not.toContain(
      'Open in plumbline',
    );
  });

  it('shows a date it cannot read as it was sent', () => {
    expect(card({ ...REPORT, created_at: 'yesterday' })).toContain(
      'Scanned yesterday',
    );
  });

  it('writes a date it can read in the reader’s locale, not as sent', () => {
    expect(card()).not.toContain('2026-10-01T12:00:00.000Z');
  });
});

describe('ReportScreen', () => {
  it('shows a skeleton while connecting', () => {
    expect(screen({ phase: 'connecting' })).toContain('Loading the report…');
  });

  it('names the domain it is waiting for', () => {
    expect(screen({ phase: 'waiting', request: 'example.com' })).toContain(
      'Loading the report: example.com…',
    );
  });

  it('shows the message of a failed call', () => {
    expect(
      screen({
        phase: 'failed',
        reason: 'error',
        message: 'example.com has not been scanned yet.',
      }),
    ).toContain('example.com has not been scanned yet.');
  });

  it('draws the report once it is ready', () => {
    expect(screen({ phase: 'ready', data: REPORT })).toContain('1 failed');
  });

  it('announces the report once it is ready', () => {
    expect(screen({ phase: 'ready', data: REPORT })).toContain(
      'Report for example.com loaded',
    );
  });

  it('carries its own styles', () => {
    expect(screen({ phase: 'connecting' })).toContain('<style>');
  });
});

describe('ReportApp', () => {
  it('starts out loading, before the host has said anything', () => {
    expect(html(<ReportApp />)).toContain('Loading the report…');
  });
});
