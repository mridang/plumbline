/**
 * @packageDocumentation
 *
 * The pieces more than one tool is built from: the shapes of the structured
 * content the views draw, and the argument fragments several tools accept in
 * the same words.
 *
 * They live beside the tools rather than inside one of them because a schema
 * two tools share must be the same schema: an assistant that learns what
 * `domain` means from one tool should not meet a different rule in the next.
 */

import { NOT_BLANK } from '@/lib/mcp';

/**
 * The `_meta` that links a tool to the View that draws its result, and the
 * words a host shows while the call runs and when it is done (ChatGPT; kept to
 * 64 characters). The View's address is given three ways because hosts read
 * different ones: `ui.resourceUri` (the MCP Apps spec), the flat
 * `ui/resourceUri` (the older form, which the official SDK still writes "for
 * compatibility with older hosts") and `openai/outputTemplate` (ChatGPT).
 */
export function viewMeta<const Uri extends string>(
  uri: Uri,
  invoking: string,
  invoked: string,
) {
  return {
    ui: { resourceUri: uri },
    'ui/resourceUri': uri,
    'openai/outputTemplate': uri,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
  } as const;
}

/**
 * Lets the View call the tool itself. ChatGPT only passes a widget's tool calls
 * through for tools that say so; MCP Apps hosts allow it by default. Only the
 * read tool the domain list calls back into carries it, never one that writes.
 */
export const WIDGET_CALLABLE = { 'openai/widgetAccessible': true } as const;

/** JSON Schema for the four counts of a report. */
export const TALLY_PROPERTIES = {
  passed: { type: 'integer' },
  warned: { type: 'integer' },
  failed: { type: 'integer' },
  skipped: { type: 'integer' },
} as const;

/** JSON Schema for the report `structuredContent`. */
export const REPORT_OUTPUT_SCHEMA = {
  type: 'object',
  required: [
    'host',
    'url',
    'created_at',
    'link',
    'passed',
    'warned',
    'failed',
    'skipped',
    'problems',
  ],
  properties: {
    host: { type: 'string' },
    url: { type: 'string' },
    created_at: { type: 'string' },
    link: { type: 'string' },
    ...TALLY_PROPERTIES,
    problems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'status', 'findings'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['failed', 'warned'] },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['message', 'resource'],
              properties: {
                message: { type: 'string' },
                resource: { type: 'string' },
                snippet: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** JSON Schema for the domain-list `structuredContent`. */
export const DOMAIN_LIST_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['domains', 'total_checks', 'link'],
  properties: {
    total_checks: { type: 'integer' },
    link: { type: 'string' },
    domains: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'host', 'checks'],
        properties: {
          id: { type: 'string' },
          host: { type: 'string' },
          checks: { type: 'integer' },
          latest: {
            type: 'object',
            properties: {
              ...TALLY_PROPERTIES,
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

/** A domain: its host name or any URL on it, never blank. */
export const DOMAIN = {
  type: 'string',
  minLength: 1,
  maxLength: 2048,
  pattern: NOT_BLANK,
  description: 'The domain, such as example.com, or any URL on it.',
} as const;

/** A list of check ids or group names. */
export const CHECK_NAMES = {
  type: 'array',
  maxItems: 500,
  items: { type: 'string', minLength: 1, maxLength: 100, pattern: NOT_BLANK },
} as const;

/** The furthest into a result an `offset` may reach. */
export const OFFSET_MAX = 10_000;

/** `offset`: how many results to skip, to read the next page of a long result. */
export const OFFSET = {
  type: 'integer',
  minimum: 0,
  maximum: OFFSET_MAX,
  description:
    'How many results to skip, to read the next page (default 0). A result that was cut short says which offset comes next.',
} as const;

/** How many checks one page of `list_checks` holds when no `limit` is given. */
export const CHECKS_PAGE_DEFAULT = 50;

/** The most checks one page of `list_checks` may hold. */
export const CHECKS_PAGE_MAX = 300;
