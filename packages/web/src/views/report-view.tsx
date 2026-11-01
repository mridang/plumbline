/* eslint-disable tailwindcss/no-custom-classname -- the widget's classes are defined in src/views/styles.ts, not in a CSS file. */
/**
 * @packageDocumentation
 *
 * The plumbline report, an MCP Apps View rendered when `get_report` runs. It
 * shows the domain, when it was scanned, how many checks passed, warned,
 * failed and were skipped, and each check that failed or warned with what it
 * found. Everything in a finding is text from the scanned site, so it is only
 * ever drawn, never sent anywhere.
 */

import type { ReactElement } from 'react';

import type { ReportData, ReportProblem } from '@/domain/mcp/ui-types';
import { safeHttpUrl } from '@/views/follow-up';
import { isReportData } from '@/views/guards';
import { Announcer, LoadingCard, MessageCard } from '@/views/status-panels';
import { STYLES } from '@/views/styles';
import { useWidgetData } from '@/views/use-widget-data';
import type { ViewState } from '@/views/view-state';

/** A count with its noun, such as "1 failed" or "12 passed". */
function counted(count: number, word: string): string {
  return `${count} ${word}`;
}

/** The date of a report, as the person's locale writes it. */
function when(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

/** One check that failed or warned, folded until opened. */
function Problem({
  problem,
  onOpenLink,
}: Readonly<{
  problem: ReportProblem;
  onOpenLink: ((url: string) => void) | undefined;
}>): ReactElement {
  const rule = safeHttpUrl(problem.reference);
  return (
    <li className="problem">
      <details>
        <summary>
          <span className={`status ${problem.status}`}>{problem.status}</span>
          <span>{problem.name}</span>
        </summary>
        <ul className="findings">
          {problem.findings.map((finding, index) => (
            <li key={index} className="finding">
              <p>{finding.message}</p>
              <span className="where">{finding.resource}</span>
              {finding.snippet ? <pre>{finding.snippet}</pre> : null}
            </li>
          ))}
        </ul>
        {problem.fixer || (rule && onOpenLink) ? (
          <div className="fix">
            {problem.fixer ? (
              <p>
                <b>Usually fixed in:</b> {problem.fixer}.
              </p>
            ) : null}
            {rule && onOpenLink ? (
              <button
                type="button"
                className="link"
                onClick={() => onOpenLink(rule)}
              >
                Read the rule
              </button>
            ) : null}
          </div>
        ) : null}
      </details>
    </li>
  );
}

/** The report itself. */
export function ReportCard({
  data,
  onOpenLink,
}: Readonly<{
  data: ReportData;
  onOpenLink: ((url: string) => void) | undefined;
}>): ReactElement {
  const link = safeHttpUrl(data.link);
  return (
    <div className="wrap">
      <article className="card">
        <div className="eyebrow">
          <span className="dot" aria-hidden="true" />
          Plumbline report
        </div>
        <h1 className="title">{data.host}</h1>
        <div className="meta">
          <span>Scanned {when(data.created_at)}</span>
        </div>
        <ul className="tally" aria-label="Results">
          <li className="failed">{counted(data.failed, 'failed')}</li>
          <li className="warned">{counted(data.warned, 'warned')}</li>
          <li className="passed">{counted(data.passed, 'passed')}</li>
          <li>{counted(data.skipped, 'skipped')}</li>
        </ul>
        {data.problems.length > 0 ? (
          <ul className="problems">
            {data.problems.map((problem) => (
              <Problem
                key={problem.id}
                problem={problem}
                onOpenLink={onOpenLink}
              />
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing failed or warned.</p>
        )}
        {link && onOpenLink ? (
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => onOpenLink(link)}
            >
              Open in Plumbline
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

/** What the screen shows for each state of the data. */
export function ReportScreen({
  state,
  onOpenLink,
}: Readonly<{
  state: ViewState<ReportData>;
  onOpenLink: ((url: string) => void) | undefined;
}>): ReactElement {
  const body = (() => {
    switch (state.phase) {
      case 'connecting':
      case 'waiting':
        return (
          <LoadingCard
            noun="the report"
            request={state.phase === 'waiting' ? state.request : undefined}
          />
        );
      case 'failed':
        return <MessageCard reason={state.reason} message={state.message} />;
      case 'ready':
        return <ReportCard data={state.data} onOpenLink={onOpenLink} />;
    }
  })();
  return (
    <>
      <style>{STYLES}</style>
      <Announcer
        message={
          state.phase === 'ready' ? `Report for ${state.data.host} loaded` : ''
        }
      />
      {body}
    </>
  );
}

/** The View: connects to the host and draws the report. */
export function ReportApp(): ReactElement {
  const bridge = useWidgetData('plumbline-report', isReportData);
  return <ReportScreen state={bridge.state} onOpenLink={bridge.openLink} />;
}
