/* eslint-disable tailwindcss/no-custom-classname -- the widget's classes are defined in src/views/styles.ts, not in a CSS file. */
/**
 * @packageDocumentation
 *
 * The plumbline domain list, an MCP Apps View rendered when `list_domains`
 * runs. Each domain shows how many checks run for it and how its newest scan
 * went. Tapping one asks the assistant for its newest report (a follow-up turn
 * that fires `get_report`, which renders the report View); a host that offers
 * no way to message the chat but does run tools gets the report fetched and
 * shown right here instead.
 */

import { useCallback, useState, type ReactElement } from 'react';

import type {
  DomainListData,
  DomainListItem,
  ReportData,
} from '@/domain/mcp/ui-types';
import { openReportPrompt, safeHttpUrl } from '@/views/follow-up';
import { isDomainListData, isReportData } from '@/views/payload';
import { ReportCard } from '@/views/report-view';
import { Announcer, LoadingCard, MessageCard } from '@/views/status-panels';
import { STYLES } from '@/views/styles';
import { useWidgetData, type WidgetBridge } from '@/views/use-widget-data';
import type { ViewState } from '@/views/view-state';

/** How a domain's newest scan went, in a few words. */
export function latestLine(item: Readonly<DomainListItem>): string {
  const { latest } = item;
  if (!latest) {
    return 'Not scanned yet';
  }
  return `${latest.failed} failed · ${latest.warned} warned · ${latest.passed} passed`;
}

/** The domains as a list of tiles. */
function DomainTiles({
  data,
  pendingId,
  onOpen,
}: Readonly<{
  data: DomainListData;
  pendingId: string | undefined;
  onOpen: (item: DomainListItem) => void;
}>): ReactElement {
  const count = `${data.domains.length} ${data.domains.length === 1 ? 'domain' : 'domains'}`;
  return (
    <>
      <div className="list-head">
        <h1>Your domains</h1>
        <span className="count">{count}</span>
      </div>
      {data.domains.length === 0 ? (
        <p className="empty">No domains yet. Ask to add one.</p>
      ) : (
        <ul className="grid">
          {data.domains.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="tile"
                aria-busy={pendingId === item.id ? 'true' : undefined}
                onClick={() => onOpen(item)}
              >
                <span className="name">
                  {item.host}
                  <span className="sub">
                    {item.checks} of {data.total_checks} checks ·{' '}
                    {latestLine(item)}
                  </span>
                </span>
                <span className="arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** What the list screen shows besides the data. */
interface ListScreenProps {
  readonly state: ViewState<DomainListData>;
  readonly pendingId: string | undefined;
  readonly notice: string | undefined;
  readonly detail: ReportData | undefined;
  readonly onOpen: (item: DomainListItem) => void;
  readonly onBack: () => void;
  readonly onOpenLink: ((url: string) => void) | undefined;
}

/** What the screen shows for each state of the data. */
export function DomainListScreen({
  state,
  pendingId,
  notice,
  detail,
  onOpen,
  onBack,
  onOpenLink,
}: Readonly<ListScreenProps>): ReactElement {
  const body = (() => {
    if (detail) {
      return (
        <>
          <div className="toolbar wrap">
            <button type="button" className="btn ghost" onClick={onBack}>
              Back
            </button>
          </div>
          <ReportCard data={detail} onOpenLink={onOpenLink} />
        </>
      );
    }
    switch (state.phase) {
      case 'connecting':
      case 'waiting':
        return <LoadingCard noun="your domains" />;
      case 'failed':
        return <MessageCard reason={state.reason} message={state.message} />;
      case 'ready': {
        const link = safeHttpUrl(state.data.link);
        return (
          <div className="wrap">
            <DomainTiles
              data={state.data}
              pendingId={pendingId}
              onOpen={onOpen}
            />
            {link && onOpenLink ? (
              <div className="more-row">
                <button
                  type="button"
                  className="link"
                  onClick={() => onOpenLink(link)}
                >
                  Manage domains in plumbline
                </button>
              </div>
            ) : null}
            {notice ? (
              <div className="status-line" role="status">
                {notice}
              </div>
            ) : null}
          </div>
        );
      }
    }
  })();
  return (
    <>
      <style>{STYLES}</style>
      <Announcer
        message={
          state.phase === 'ready'
            ? `${state.data.domains.length} domains loaded`
            : ''
        }
      />
      {body}
    </>
  );
}

/**
 * Open a domain's newest report: ask the assistant for it, or, when the host
 * takes no messages but runs tools, fetch it and show it in place. Resolves to
 * the report to show here, a notice to show instead, or nothing (the
 * assistant took the request).
 */
export async function openReport(
  item: Readonly<DomainListItem>,
  bridge: Pick<
    WidgetBridge<DomainListData>,
    'sendFollowUp' | 'canCallTools' | 'callTool'
  >,
): Promise<{ readonly report?: ReportData; readonly notice?: string }> {
  const prompt = openReportPrompt(item.host);
  if (prompt && (await bridge.sendFollowUp(prompt))) {
    return {};
  }
  if (!bridge.canCallTools) {
    return { notice: `Ask the assistant for the report on ${item.host}.` };
  }
  const outcome = await bridge.callTool(
    'get_report',
    { domain: item.host },
    isReportData,
  );
  return outcome.kind === 'data'
    ? { report: outcome.data }
    : { notice: outcome.text };
}

/** The View: connects to the host and draws the domain list. */
export function DomainListApp(): ReactElement {
  const bridge = useWidgetData('plumbline-domain-list', isDomainListData);
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [detail, setDetail] = useState<ReportData | undefined>();
  const { sendFollowUp, canCallTools, callTool } = bridge;

  const open = useCallback(
    async (item: DomainListItem) => {
      setPendingId(item.id);
      setNotice(undefined);
      const result: { readonly report?: ReportData; readonly notice?: string } =
        await openReport(item, { sendFollowUp, canCallTools, callTool }).catch(
          () => ({ notice: 'That did not work. Try again.' }),
        );
      setPendingId(undefined);
      setNotice(result.notice);
      setDetail(result.report);
    },
    [sendFollowUp, canCallTools, callTool],
  );

  return (
    <DomainListScreen
      state={bridge.state}
      pendingId={pendingId}
      notice={notice}
      detail={detail}
      onOpen={(item) => void open(item)}
      onBack={() => setDetail(undefined)}
      onOpenLink={bridge.openLink}
    />
  );
}
