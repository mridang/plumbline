/**
 * Turns report data into one self-contained HTML document: inline CSS, a
 * little inline JavaScript for the group filter, no external requests. All
 * text that originates from findings, snippets or hint metadata is escaped
 * and only http(s) links are rendered as links.
 */
import { escapeHtml, link, safeUrl } from './html.js';
import {
  SEVERITY,
  SOURCE_GROUPS,
  buildSections,
  countFindings,
  type Counts,
  type Finding,
  type HintBlock,
  type HintInfo,
  type Origin,
  type Section,
} from './sections.js';

/** Everything the renderer needs. */
export interface ReportData {
  /** The scanned URL. */
  target: string;
  /** Date and time of the scan, already formatted. */
  date: string;
  hints: readonly HintInfo[];
  findings: readonly Finding[];
}

/** The id of the hint whose message becomes the summary card. */
const SCORE_HINT = 'extra/agent-score';

/** One category line of the agent score. */
interface ScoreCategory {
  name: string;
  value: number;
}

/** The parsed agent readiness score. */
interface AgentScore {
  score: number;
  level: string;
  categories: ScoreCategory[];
}

/**
 * Parses 'Agent readiness score 27/100, level 1 "Basic Web Presence".
 * Discoverability 50 (2/4); ...'.
 *
 * @param message The agent-score finding message.
 * @returns The score, or `undefined` when the message has another shape.
 */
function parseAgentScore(message: string): AgentScore | undefined {
  const head =
    /^Agent readiness score (\d+)\/100, level (\d+)(?: "([^"]*)")?\.?\s*(.*)$/s.exec(
      message,
    );
  if (!head) {
    return undefined;
  }
  const categories: ScoreCategory[] = [];
  for (const part of (head[4] ?? '').split(';')) {
    const match = /^\s*(.+?)\s+(\d+)(?:\s*\(\d+\/\d+\))?\s*\.?\s*$/.exec(part);
    if (match) {
      categories.push({
        name: match[1] ?? '',
        value: Math.min(100, Number(match[2])),
      });
    }
  }
  const title = head[3] ? ` "${head[3]}"` : '';
  return {
    score: Number(head[1]),
    level: `level ${head[2]}${title}`,
    categories,
  };
}

/** Renders the summary card for the agent score finding, if there is one. */
function renderScoreCard(findings: readonly Finding[]): string {
  const finding = findings.find((f) => f.hintId === SCORE_HINT);
  if (!finding) {
    return '';
  }
  const score = parseAgentScore(finding.message);
  if (!score) {
    return `<aside class="card score"><h2>Agent readiness</h2><p>${escapeHtml(finding.message)}</p></aside>`;
  }
  const bars = score.categories
    .map(
      (c) =>
        `<li><span>${escapeHtml(c.name)}</span><span class="bar"><i style="width:${c.value}%"></i></span><b>${c.value}</b></li>`,
    )
    .join('');
  return `<aside class="card score"><h2>Agent readiness</h2><p class="big">${score.score}<small>/100</small> <span>${escapeHtml(score.level)}</span></p><ul class="bars">${bars}</ul></aside>`;
}

/** Renders the severity count chips; zero counts are left out. */
function renderCounts(counts: Counts): string {
  const chip = (kind: string, n: number): string =>
    n > 0 ? `<span class="chip ${kind}">${n} ${kind}</span>` : '';
  return (
    chip('error', counts.error) +
    chip('warning', counts.warning) +
    chip('hint', counts.hint)
  );
}

/** Maps a numeric severity to its label. */
function severityLabel(severity: number): string {
  if (severity >= SEVERITY.error) {
    return 'error';
  }
  return severity === SEVERITY.warning ? 'warning' : 'hint';
}

/** Renders one finding. */
function renderFinding(finding: Finding): string {
  const label = severityLabel(finding.severity);
  const where =
    finding.location && finding.location.line >= 0
      ? ` <span class="loc">${finding.location.line}:${finding.location.column}</span>`
      : '';
  const code = finding.sourceCode
    ? `<pre><code>${escapeHtml(finding.sourceCode)}</code>${
        finding.codeLanguage
          ? `<span class="lang">${escapeHtml(finding.codeLanguage)}</span>`
          : ''
      }</pre>`
    : '';
  const docs = (finding.documentation ?? []).length
    ? `<p class="docs">Further reading: ${(finding.documentation ?? [])
        .map((d) => link(d.link, d.text))
        .join(', ')}</p>`
    : '';
  return `<li class="finding"><span class="sev ${label}">${label}</span> <span class="msg">${escapeHtml(finding.message)}</span><div class="res">${link(finding.resource)}${where}</div>${code}${docs}</li>`;
}

/** Renders the two stock webhint buttons, for hints that are not ours. */
function renderStockButtons(id: string): string {
  const base = `https://webhint.io/docs/user-guide/hints/hint-${escapeHtml(id)}/`;
  return `<p class="buttons"><a class="btn" href="${base}#why-is-this-important" target="_blank" rel="noopener noreferrer">Why is this important</a> <a class="btn" href="${base}#examples-that-pass-the-hint" target="_blank" rel="noopener noreferrer">How to fix it</a></p>`;
}

/** Renders where a hint came from: its upstream checks, links and licences. */
function renderOrigins(origins: readonly Origin[] | undefined): string {
  if (origins === undefined) {
    return '';
  }
  if (origins.length === 0) {
    return '<p class="origin">Written for this package; there is no upstream check.</p>';
  }
  const items = origins
    .map((o) => {
      const docs = safeUrl(o.docsUrl) ? ` (${link(o.docsUrl, 'docs')})` : '';
      return `<li><span class="badge">${escapeHtml(o.source)}</span> ${link(o.url, o.title || o.upstreamId)}${docs} <span class="muted">${escapeHtml(o.licence)}</span><br>${escapeHtml(o.summary)}</li>`;
    })
    .join('');
  return `<details class="origins"><summary>Origin (${origins.length})</summary><ul>${items}</ul></details>`;
}

/** Renders the body header of a hint: description, reference, origins, buttons. */
function renderHintHead(block: HintBlock): string {
  const { info } = block;
  const reference = safeUrl(info.url)
    ? `<p class="ref">${link(info.url, 'Reference')}</p>`
    : '';
  const description = info.description
    ? `<p class="desc">${escapeHtml(info.description)}</p>`
    : '';
  return `${description}${reference}${renderOrigins(info.origins)}${info.id.startsWith('extra/') ? '' : renderStockButtons(info.id)}`;
}

/** Renders a hint that has findings as a collapsible block. */
function renderHint(block: HintBlock): string {
  const { info } = block;
  const badges = block.badges
    .map((b) => `<span class="badge">${escapeHtml(b)}</span>`)
    .join('');
  return `<details class="hint" data-groups="${escapeHtml(info.groups.join(' '))}"><summary><span class="name">${escapeHtml(info.name)}</span> <code>${escapeHtml(info.id)}</code> ${badges}<span class="counts">${renderCounts(block.counts)}</span></summary>${renderHintHead(block)}<ul class="findings">${block.findings.map(renderFinding).join('')}</ul></details>`;
}

/** Renders the collapsed list of hints that ran without findings. */
function renderPassed(blocks: readonly HintBlock[]): string {
  if (blocks.length === 0) {
    return '';
  }
  const items = blocks
    .map(
      (b) =>
        `<li data-groups="${escapeHtml(b.info.groups.join(' '))}" title="${escapeHtml(b.info.description)}">${escapeHtml(b.info.name)} <code>${escapeHtml(b.info.id)}</code></li>`,
    )
    .join('');
  return `<details class="passed"><summary>${blocks.length} passed</summary><ul>${items}</ul></details>`;
}

/** Makes a section key safe to use inside an id attribute. */
function anchor(key: string): string {
  return `sec-${key.replace(/[^a-z0-9-]/gi, '-')}`;
}

/** Renders one section of the report. */
function renderSection(section: Section): string {
  const failing = section.hints.filter((b) => b.findings.length > 0);
  const passing = section.hints.filter((b) => b.findings.length === 0);
  const status = section.passed
    ? '<span class="ok" title="Passed">&#10003;</span>'
    : renderCounts(section.counts);
  return `<section class="section" id="${anchor(section.key)}"><h2>${escapeHtml(section.title)} ${status}</h2>${section.description ? `<p class="section-desc">${escapeHtml(section.description)}</p>` : ''}${failing.map(renderHint).join('')}${renderPassed(passing)}</section>`;
}

/** Renders the sidebar navigation. */
function renderNav(sections: readonly Section[]): string {
  return sections
    .map(
      (s) =>
        `<li><a href="#${anchor(s.key)}">${escapeHtml(s.title)}</a>${
          s.passed
            ? '<span class="ok">&#10003;</span>'
            : `<span class="counts">${renderCounts(s.counts)}</span>`
        }</li>`,
    )
    .join('');
}

/** Renders the source group filter; only sources that occur are offered. */
function renderFilter(hints: readonly HintInfo[]): string {
  const present = SOURCE_GROUPS.filter((g) =>
    hints.some((h) => h.groups.includes(g)),
  );
  if (present.length === 0) {
    return '';
  }
  return `<div class="filter" role="group" aria-label="Filter by source">${present
    .map(
      (g) =>
        `<button type="button" class="toggle" aria-pressed="false" data-group="${g}">${g}</button>`,
    )
    .join('')}</div>`;
}

const STYLE = `
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6570;--card:#f5f7fa;--line:#d8dee4;--err:#c62828;--warn:#b26a00;--hint:#1565c0;--ok:#2e7d32}
@media(prefers-color-scheme:dark){:root{--bg:#14181d;--fg:#e6e9ec;--muted:#9aa5b1;--card:#1d232a;--line:#2f3842;--err:#ef5350;--warn:#ffb74d;--hint:#64b5f6;--ok:#66bb6a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
a{color:var(--hint)}code,pre{font-family:ui-monospace,Menlo,monospace;font-size:13px}
.layout{display:flex;gap:24px;max-width:1200px;margin:0 auto;padding:16px}
nav{flex:0 0 230px;position:sticky;top:16px;align-self:flex-start;max-height:100vh;overflow:auto}
nav ul{list-style:none;margin:0;padding:0}nav li{display:flex;justify-content:space-between;gap:8px;padding:4px 0}
main{flex:1;min-width:0}h1{margin:0 0 4px;font-size:22px;word-break:break-all}h2{font-size:18px;margin:24px 0 8px}
.meta{color:var(--muted);margin:0 0 12px}.totals{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:12px 0}
.score .big{font-size:32px;font-weight:700;margin:0}.score small{font-size:16px;color:var(--muted)}.score .big span{font-size:15px;font-weight:400}
.bars{list-style:none;margin:8px 0 0;padding:0}.bars li{display:grid;grid-template-columns:minmax(110px,1fr) 2fr 36px;gap:8px;align-items:center}
.bar{background:var(--line);border-radius:4px;height:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--ok)}
.chip{display:inline-block;border-radius:10px;padding:0 8px;font-size:12px;margin-left:4px;border:1px solid currentColor}
.chip.error,.sev.error{color:var(--err)}.chip.warning,.sev.warning{color:var(--warn)}.chip.hint,.sev.hint{color:var(--hint)}
.sev{font-size:12px;font-weight:700;text-transform:uppercase}.ok{color:var(--ok);font-weight:700}
.filter{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.toggle{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:14px;padding:2px 10px;cursor:pointer}
.toggle[aria-pressed=true]{background:var(--hint);color:var(--bg);border-color:var(--hint)}
details.hint,details.passed{border:1px solid var(--line);border-radius:8px;margin:8px 0;padding:8px 12px}
summary{cursor:pointer}.name{font-weight:600}.muted{color:var(--muted);font-size:12px}.section-desc{color:var(--muted);margin:-4px 0 8px}details.origins{margin:6px 0;font-size:13px}details.origins ul{margin:6px 0 0;padding-left:18px}details.origins li{margin:6px 0}.origin{color:var(--muted);font-size:13px}.badge{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:0 6px;font-size:11px;margin-left:4px;color:var(--muted)}
.desc,.ref{margin:6px 0;color:var(--muted)}.btn{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:2px 10px;text-decoration:none}
.findings{list-style:none;padding:0}.finding{border-top:1px solid var(--line);padding:8px 0}.res,.loc,.docs{color:var(--muted);font-size:13px;word-break:break-all}
pre{position:relative;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px;overflow:auto;margin:6px 0}
.lang{position:absolute;top:2px;right:6px;font-size:10px;color:var(--muted)}
.hidden{display:none!important}
@media(max-width:760px){.layout{flex-direction:column}nav{position:static;flex-basis:auto;max-height:none}}
`;

/**
 * Inline script for the source filter. It reads only `data-*` attributes
 * and attaches listeners itself, so nothing from the report data is ever
 * evaluated as code.
 */
const SCRIPT = `
(function(){
var on=new Set();
function apply(){
document.querySelectorAll('[data-groups]').forEach(function(el){
var g=(el.getAttribute('data-groups')||'').split(' ');
var show=on.size===0||g.some(function(x){return on.has(x)});
el.classList.toggle('hidden',!show);
});
document.querySelectorAll('section.section').forEach(function(s){
var items=s.querySelectorAll('[data-groups]');
var visible=Array.prototype.some.call(items,function(i){return !i.classList.contains('hidden')});
s.classList.toggle('hidden',on.size>0&&items.length>0&&!visible);
});
}
document.querySelectorAll('button[data-group]').forEach(function(b){
b.addEventListener('click',function(){
var g=b.getAttribute('data-group');
if(on.has(g)){on.delete(g)}else{on.add(g)}
b.setAttribute('aria-pressed',on.has(g)?'true':'false');
apply();
});
});
})();
`;

/**
 * Renders the whole report.
 *
 * @param data Scan target, date, hints that ran and all findings.
 * @returns A complete HTML document as a string.
 */
export function generateReport(data: ReportData): string {
  const sections = buildSections(data.hints, data.findings);
  const totals = countFindings(data.findings);
  const hintsRun = sections.reduce((n, s) => n + s.hints.length, 0);
  const withFindings = sections.reduce(
    (n, s) => n + s.hints.filter((b) => b.findings.length > 0).length,
    0,
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>webhint report: ${escapeHtml(data.target)}</title><style>${STYLE}</style></head>
<body><div class="layout"><nav aria-label="Sections"><ul>${renderNav(sections)}</ul></nav>
<main><h1>${link(data.target)}</h1><p class="meta">${escapeHtml(data.date)}</p>
<div class="totals">${renderCounts(totals) || '<span class="ok">No findings</span>'}</div>
<p class="meta">${hintsRun} hints run, ${withFindings} with findings</p>
${renderScoreCard(data.findings)}${renderFilter(data.hints)}${sections.map(renderSection).join('')}</main></div>
<script>${SCRIPT}</script></body></html>
`;
}
