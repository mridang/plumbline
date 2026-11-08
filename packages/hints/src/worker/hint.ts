/**
 * What the hints take from webhint's core at run time, for a runtime that
 * cannot load the core (a Cloudflare Worker: the core reads files and loads
 * packages by name). The hints only need the scope names; the rest of webhint
 * is types. `package.json` points `#hint` here under the `workerd` condition.
 */

/** Where a hint applies: the site, a local project, or either. Same values as webhint's. */
export enum HintScope {
  local = 'local',
  site = 'site',
  any = 'any',
}
