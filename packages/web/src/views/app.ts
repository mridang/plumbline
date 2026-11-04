/**
 * @packageDocumentation
 *
 * What the Views of this app have of their own: the tool arguments that say
 * what a call was for, the colours, and the rules for the report and the
 * domain list. Everything else in `src/views/` is the same in every app.
 */

import type { ThemePalette } from '@/views/palette';

/**
 * The tool arguments that name what a call was asked for, best first: the
 * `domain`, or the search `query`. A View shows the first one given while it
 * waits.
 */
export const REQUEST_ARGUMENTS: readonly string[] = ['domain', 'query'];

/** The light theme. */
export const LIGHT_PALETTE: ThemePalette = {
  accent: '#4338ca',
  accentStrong: '#3730a3',
  accentInk: '#4338ca',
  accentSoft: '#e0e7ff',
  accentText: '#3730a3',
  tealSoft: '#d4f3ee',
  tealText: '#0f6b61',
  violetSoft: '#e7e1fd',
  violetText: '#5b34c7',
  fallbackSurface: '#fbfaf8',
  fallbackText: '#1f2430',
  fallbackMuted: '#5b6270',
};

/** The dark theme. */
export const DARK_PALETTE: ThemePalette = {
  accent: '#4f46e5',
  accentStrong: '#4338ca',
  accentInk: '#a5b4fc',
  accentSoft: '#1e1b4b',
  accentText: '#c7d2fe',
  tealSoft: '#113b37',
  tealText: '#7fe0d3',
  violetSoft: '#2c2350',
  violetText: '#c3b0f7',
  fallbackSurface: '#252528',
  fallbackText: '#ececed',
  fallbackMuted: '#a8a8b0',
};

/** The rules for the report and the domain list. */
export const APP_STYLES = `
/* --- report --- */
.tally { margin-top:14px; display:flex; flex-wrap:wrap; gap:6px; padding:0; list-style-type:""; }
.tally li { padding:4px 10px; border-radius:999px; font-size:.75rem; font-weight:650; white-space:nowrap;
  background: var(--surface-2); color: var(--text); }
.tally .failed, .status.failed { background: color-mix(in srgb, #b91c1c 14%, transparent); color: var(--color-text-danger, #b91c1c); }
.tally .warned, .status.warned { background: color-mix(in srgb, #a16207 16%, transparent); color: var(--color-text-warning, #a16207); }
.tally .passed { background: color-mix(in srgb, #15803d 14%, transparent); color: var(--color-text-success, #15803d); }
.problems { margin:16px 0 0; padding:0; list-style-type:""; }
.problem { border-top:1px solid var(--border); padding:10px 0; }
.problem summary { display:flex; align-items:center; gap:9px; min-height:32px; cursor:pointer; font-weight:620; }
.status { flex:none; padding:2px 8px; border-radius:999px; font-size:.625rem; font-weight:700;
  letter-spacing:.05em; text-transform:uppercase; }
.findings { margin:8px 0 0; padding:0 0 0 4px; list-style-type:""; display:grid; gap:8px; }
.finding p { margin:0; line-height:1.5; overflow-wrap:anywhere; }
.finding .where { color: var(--muted); font-size:.75rem; overflow-wrap:anywhere; }
.finding pre { margin:4px 0 0; padding:8px 10px; border-radius: var(--radius-sm); background: var(--surface-2);
  font-size:.75rem; white-space:pre-wrap; overflow-wrap:anywhere; max-height:10rem; overflow:auto; }
.fix { margin-top:10px; padding:10px 12px; border-radius: var(--radius-sm); background: var(--accent-soft);
  color: var(--accent-text); }
.fix p { margin:0; line-height:1.5; overflow-wrap:anywhere; }
.fix .link { min-height:32px; color: inherit; }
.tile .sub { display:block; margin-top:2px; font-size:.75rem; font-weight:500; color: var(--muted); }

`;
