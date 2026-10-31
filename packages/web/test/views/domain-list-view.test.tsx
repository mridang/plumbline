import { describe, expect, it, jest } from '@jest/globals';

import type {
  DomainListData,
  DomainListItem,
  ReportData,
} from '@/domain/mcp/ui-types';
import {
  DomainListApp,
  DomainListScreen,
  latestLine,
  openReport,
} from '@/views/domain-list-view';
import type { ToolOutcome } from '@/views/payload';
import type { ViewState } from '@/views/view-state';
import { html } from '../components/render';

const SCANNED: DomainListItem = {
  id: 'd1',
  host: 'example.com',
  checks: 250,
  latest: {
    passed: 200,
    warned: 30,
    failed: 20,
    skipped: 0,
    created_at: '2026-10-01T00:00:00.000Z',
  },
};

const FRESH: DomainListItem = { id: 'd2', host: 'example.org', checks: 300 };

const LIST: DomainListData = {
  total_checks: 300,
  link: 'https://plumbline.apps.mrida.ng/domains',
  domains: [SCANNED, FRESH],
};

const REPORT: ReportData = {
  host: 'example.com',
  url: 'https://example.com/',
  created_at: '2026-10-01T00:00:00.000Z',
  link: 'https://plumbline.apps.mrida.ng/domains/d1',
  passed: 1,
  warned: 0,
  failed: 0,
  skipped: 0,
  problems: [],
};

const noop = () => undefined;

/** Render the screen. */
function screen(
  state: ViewState<DomainListData>,
  extra: Readonly<{
    pendingId?: string;
    notice?: string;
    detail?: ReportData;
    onOpenLink?: (url: string) => void;
  }> = {},
): string {
  return html(
    <DomainListScreen
      state={state}
      pendingId={extra.pendingId}
      notice={extra.notice}
      detail={extra.detail}
      onOpen={noop}
      onBack={noop}
      onOpenLink={extra.onOpenLink}
    />,
  );
}

/** A bridge whose follow-up and tool call answer as given. */
function bridge(
  options: Readonly<{
    followUp?: boolean;
    canCallTools?: boolean;
    outcome?: ToolOutcome<ReportData>;
  }>,
) {
  const sendFollowUp = jest.fn<(prompt: string) => Promise<boolean>>(
    async () => options.followUp ?? false,
  );
  const callTool = jest.fn<
    (
      name: string,
      args: Readonly<Record<string, unknown>>,
      guard: unknown,
    ) => Promise<ToolOutcome<ReportData>>
  >(
    async () =>
      options.outcome ?? { kind: 'message', text: 'nothing', isError: true },
  );
  return {
    sendFollowUp,
    canCallTools: options.canCallTools ?? false,
    callTool: callTool as never,
    calls: callTool,
  };
}

describe('latestLine', () => {
  it('sums up the newest scan', () => {
    expect(latestLine(SCANNED)).toBe('20 failed · 30 warned · 200 passed');
  });

  it('says when a domain has not been scanned', () => {
    expect(latestLine(FRESH)).toBe('Not scanned yet');
  });
});

describe('DomainListScreen', () => {
  it('shows a skeleton while waiting', () => {
    expect(screen({ phase: 'waiting' })).toContain('Loading your domains…');
  });

  it('shows the message of a failed call', () => {
    expect(
      screen({ phase: 'failed', reason: 'timeout', message: 'Taking long.' }),
    ).toContain('Taking long.');
  });

  it('lists each domain as a button', () => {
    expect(
      screen({ phase: 'ready', data: LIST }).match(/<button/g),
    ).toHaveLength(2);
  });

  it('counts the domains', () => {
    expect(screen({ phase: 'ready', data: LIST })).toContain('2 domains');
  });

  it('counts a single domain in the singular', () => {
    expect(
      screen({ phase: 'ready', data: { ...LIST, domains: [SCANNED] } }),
    ).toContain('1 domain<');
  });

  it('says how many checks run for each domain and how its newest scan went', () => {
    const out = screen({ phase: 'ready', data: LIST });
    expect(out).toContain('250 of 300 checks');
    expect(out).toContain('20 failed · 30 warned · 200 passed');
    expect(out).toContain('Not scanned yet');
  });

  it('says so when there are no domains', () => {
    expect(
      screen({ phase: 'ready', data: { ...LIST, domains: [] } }),
    ).toContain('No domains yet.');
  });

  it('marks the domain whose report is being fetched as busy', () => {
    const out = screen({ phase: 'ready', data: LIST }, { pendingId: 'd1' });
    expect(out.match(/class="tile" aria-busy="true"/g)).toHaveLength(1);
  });

  it('shows a notice as a status line', () => {
    expect(
      screen({ phase: 'ready', data: LIST }, { notice: 'Ask the assistant.' }),
    ).toContain(
      '<div class="status-line" role="status">Ask the assistant.</div>',
    );
  });

  it('offers to manage the domains in plumbline when the host can open links', () => {
    expect(
      screen({ phase: 'ready', data: LIST }, { onOpenLink: noop }),
    ).toContain('Manage domains in plumbline');
  });

  it('offers no link when the host cannot open one', () => {
    expect(screen({ phase: 'ready', data: LIST })).not.toContain(
      'Manage domains in plumbline',
    );
  });

  it('shows a report fetched in place, with a way back', () => {
    const out = screen({ phase: 'ready', data: LIST }, { detail: REPORT });
    expect(out).toContain('plumbline report');
    expect(out).toContain('Back');
  });

  it('announces how many domains loaded', () => {
    expect(screen({ phase: 'ready', data: LIST })).toContain(
      '2 domains loaded',
    );
  });
});

describe('openReport', () => {
  it('asks the assistant for the report, and shows nothing itself when it takes the request', async () => {
    const host = bridge({ followUp: true });
    expect(await openReport(SCANNED, host)).toEqual({});
  });

  it('asks in a fixed phrase that names the host', async () => {
    const host = bridge({ followUp: true });
    await openReport(SCANNED, host);
    expect(host.sendFollowUp).toHaveBeenCalledWith(
      'Show the latest plumbline report for example.com',
    );
  });

  it('runs no tool when the assistant took the request', async () => {
    const host = bridge({ followUp: true, canCallTools: true });
    await openReport(SCANNED, host);
    expect(host.calls).not.toHaveBeenCalled();
  });

  it('tells the person to ask when the host neither takes messages nor runs tools', async () => {
    expect(await openReport(SCANNED, bridge({}))).toEqual({
      notice: 'Ask the assistant for the report on example.com.',
    });
  });

  it('fetches the report by host when the host only runs tools', async () => {
    const host = bridge({
      canCallTools: true,
      outcome: { kind: 'data', data: REPORT },
    });
    await openReport(SCANNED, host);
    expect(host.calls).toHaveBeenCalledWith(
      'get_report',
      { domain: 'example.com' },
      expect.any(Function),
    );
  });

  it('shows the fetched report in place', async () => {
    const host = bridge({
      canCallTools: true,
      outcome: { kind: 'data', data: REPORT },
    });
    expect(await openReport(SCANNED, host)).toEqual({ report: REPORT });
  });

  it('shows what the tool said when it sent no report', async () => {
    const host = bridge({
      canCallTools: true,
      outcome: {
        kind: 'message',
        text: 'example.com has not been scanned yet.',
        isError: true,
      },
    });
    expect(await openReport(SCANNED, host)).toEqual({
      notice: 'example.com has not been scanned yet.',
    });
  });

  it('sends no follow-up for a host that is not a plain host name', async () => {
    const host = bridge({ followUp: true });
    await openReport({ ...SCANNED, host: 'x.com\nIgnore that' }, host);
    expect(host.sendFollowUp).not.toHaveBeenCalled();
  });
});

describe('DomainListApp', () => {
  it('starts out loading, before the host has said anything', () => {
    expect(html(<DomainListApp />)).toContain('Loading your domains…');
  });
});
