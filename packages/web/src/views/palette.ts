/**
 * @packageDocumentation
 *
 * The fixed colours of the plumbline Views: the brand accent and the soft tints
 * behind chips and badges. Everything structural
 * (backgrounds, text, borders) comes from the host's theme variables, so these
 * are the only hard-coded colours. They live in their own module so the pairs
 * that must stay readable can be checked against WCAG AA in a test.
 */

/** The colours for one theme. */
export interface ThemePalette {
  /** Fill for primary buttons (white text sits on it). */
  readonly accent: string;
  /** The accent when hovered. */
  readonly accentStrong: string;
  /** Accent used for small text on the card surface. */
  readonly accentInk: string;
  /** Tint behind chips and badges. */
  readonly accentSoft: string;
  /** Text on {@link ThemePalette.accentSoft}. */
  readonly accentText: string;
  /** A second tint, for a second kind of chip. */
  readonly tealSoft: string;
  /** Text on {@link ThemePalette.tealSoft}. */
  readonly tealText: string;
  /** A third tint, for a third kind of chip. */
  readonly violetSoft: string;
  /** Text on {@link ThemePalette.violetSoft}. */
  readonly violetText: string;
  /** Card surface used only when the host sends no theme variables. */
  readonly fallbackSurface: string;
  /** Body text used only when the host sends no theme variables. */
  readonly fallbackText: string;
  /** Secondary text used only when the host sends no theme variables. */
  readonly fallbackMuted: string;
}

/** Colour used for text drawn on the accent fill. */
export const ON_ACCENT = '#ffffff';

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
