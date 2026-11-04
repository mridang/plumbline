/**
 * @packageDocumentation
 *
 * The one runtime value the hints take from `hint`: the scope enum. Webhint's
 * engine needs Node and a Chromium, so a browser gets this instead; the rest of
 * what the hints import from `hint` is types, which vanish when compiled.
 */

/** Where a hint applies, as webhint's `HintScope`. */
export enum HintScope {
  local = 'local',
  site = 'site',
  any = 'any',
}
