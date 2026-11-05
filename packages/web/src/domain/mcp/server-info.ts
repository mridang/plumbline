/**
 * @packageDocumentation
 *
 * What the MCP server says about itself: its name, version, description and
 * icons, the capabilities it really has, and the guidance an assistant reads
 * before it uses the tools. The same answers go out in the older revisions'
 * `initialize` reply, in `server/discover`, and (for the identity) in the
 * `_meta` of every result of the newest revision.
 */

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/utils/site';

/**
 * The version of this server. It follows `package.json`, and a test fails if the
 * two drift apart, so bump them together. (The file is not read at run time: a
 * Worker has no file system, and importing the whole manifest would ship it in
 * the bundle.)
 */
export const SERVER_VERSION = '0.1.0';

/** The identifier of the MCP Apps extension, which carries the interactive views. */
export const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/** The `_meta` key under which a result of the newest revision names its server. */
export const SERVER_INFO_META_KEY = 'io.modelcontextprotocol/serverInfo';

/**
 * Icons for connector lists, as absolute HTTPS addresses on this site (the spec
 * wants icons fetched from the server's own origin, and PNG is the format every
 * client must handle). The files are in `public/icons` and also back the web
 * app manifest.
 */
const SERVER_ICONS = [
  {
    src: `${SITE_URL}/icons/icon-192.png`,
    mimeType: 'image/png',
    sizes: ['192x192'],
  },
  {
    src: `${SITE_URL}/icons/icon-512.png`,
    mimeType: 'image/png',
    sizes: ['512x512'],
  },
] as const;

/** The name, version and look this server reports about itself. */
export const SERVER_INFO = {
  name: SITE_NAME.toLowerCase(),
  title: SITE_NAME,
  version: SERVER_VERSION,
  description: SITE_DESCRIPTION,
  websiteUrl: SITE_URL,
  icons: SERVER_ICONS,
} as const;

/**
 * What this server can do, as announced in the handshake and in discovery.
 * Only things it really does are listed: tools, resources (the interactive
 * views; the list never changes while running, so there is no `listChanged` and
 * nothing to subscribe to), prompts (starting points a host shows as slash
 * commands) and the MCP Apps extension that those views belong to. The
 * extension needs no settings, so its entry is empty.
 *
 * Hosts that do not know the extension still get every tool's text result, so
 * the tools are not withheld from them: the server keeps no record of what a
 * client said in its `initialize`, and what it lists must not vary per caller.
 */
export const CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {},
  extensions: { [UI_EXTENSION_ID]: {} },
} as const;

/**
 * What an assistant should know before using the tools. Kept to what the tool
 * descriptions cannot say on their own, which is how to choose between tools;
 * a host may put all of it in the model's context, so a test caps its length.
 */
export const INSTRUCTIONS =
  "Plumbline keeps the user's domains and checks each one against a few hundred rules for security headers, TLS, DNS, mail, privacy, SEO, social cards and AI-agent readiness. " +
  'A tool that takes a domain accepts its host name (example.com) or any URL on it. ' +
  'The checks run in a web browser or with the Plumbline CLI, never on this server: scan_domain gives the link that runs them and saves a report, and the CLI command for a full scan; get_report and list_reports read what was saved. ' +
  'list_checks shows every check with its id and groups; configure_checks switches checks on or off for one domain by id or by group (tls, owasp, seo, …). ' +
  "Domains come from the user's GitHub repositories; use remove_domain only when the user asks to stop keeping one.";
