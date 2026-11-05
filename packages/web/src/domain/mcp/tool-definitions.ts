/**
 * @packageDocumentation
 *
 * What the MCP server advertises: the catalogue of tools an assistant may call,
 * with their input schemas, and the schemas and metadata that tell the host how
 * to draw the results. Pure data; what the tools do is in `tool-calls.ts`.
 *
 * The input schemas are also the contract the server enforces: `tool-calls.ts`
 * checks every call's arguments against them (see `json-schema.ts`) before
 * running anything, so a schema here is a promise about what the tool accepts,
 * not just documentation. They are written in JSON Schema 2020-12, the MCP
 * default dialect, and use only the keywords that checker understands.
 *
 * Descriptions say what a tool does and returns. Advice on *when* to use which
 * tool belongs in the server's instructions, not here.
 */

import { scopeForTool } from '@/lib/oauth';
import { NOT_BLANK } from '@/lib/mcp';
import {
  DOMAIN_LIST_RESOURCE_URI,
  REPORT_RESOURCE_URI,
} from '@/domain/mcp/ui-resources';

/**
 * The `_meta` that links a tool to the View that draws its result, and the
 * words a host shows while the call runs and when it is done (ChatGPT; kept to
 * 64 characters). The View's address is given three ways because hosts read
 * different ones: `ui.resourceUri` (the MCP Apps spec), the flat
 * `ui/resourceUri` (the older form, which the official SDK still writes "for
 * compatibility with older hosts") and `openai/outputTemplate` (ChatGPT).
 */
function viewMeta<const Uri extends string>(
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
const WIDGET_CALLABLE = { 'openai/widgetAccessible': true } as const;

/** JSON Schema for the four counts of a report. */
const TALLY_PROPERTIES = {
  passed: { type: 'integer' },
  warned: { type: 'integer' },
  failed: { type: 'integer' },
  skipped: { type: 'integer' },
} as const;

/** JSON Schema for the report `structuredContent`. */
const REPORT_OUTPUT_SCHEMA = {
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
const DOMAIN_LIST_OUTPUT_SCHEMA = {
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
const DOMAIN = {
  type: 'string',
  minLength: 1,
  maxLength: 2048,
  pattern: NOT_BLANK,
  description: 'The domain, such as example.com, or any URL on it.',
} as const;

/** A list of check ids or group names. */
const CHECK_NAMES = {
  type: 'array',
  maxItems: 500,
  items: { type: 'string', minLength: 1, maxLength: 100, pattern: NOT_BLANK },
} as const;

/** The furthest into a result an `offset` may reach. */
const OFFSET_MAX = 10_000;

/** `offset`: how many results to skip, to read the next page of a long result. */
const OFFSET = {
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

/** The tools, without the title and hints that {@link TOOL_PRESENTATION} adds. */
const TOOL_DEFINITIONS = [
  {
    name: 'list_checks',
    description:
      'Lists the checks Plumbline can run, with their ids, names, groups and what each looks at, 50 at a time in id order. Narrow it to one group (a source such as owasp or a topic such as tls) or to checks whose id, name or description contains some text. Without arguments it starts with the list of groups.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        group: {
          type: 'string',
          maxLength: 100,
          description: 'Only the checks in this group, such as tls or seo.',
        },
        query: {
          type: 'string',
          maxLength: 200,
          description:
            'Only checks whose id, name or description has this text.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: CHECKS_PAGE_MAX,
          description: `Most checks to return (default ${CHECKS_PAGE_DEFAULT}, at most ${CHECKS_PAGE_MAX}).`,
        },
        offset: OFFSET,
      },
    },
  },
  {
    name: 'list_domains',
    description:
      "Lists the user's domains, with how many checks run for each and how its newest scan went.",
    inputSchema: { type: 'object', additionalProperties: false },
    outputSchema: DOMAIN_LIST_OUTPUT_SCHEMA,
    _meta: viewMeta(
      DOMAIN_LIST_RESOURCE_URI,
      'Listing your domains…',
      'Here they are',
    ),
  },
  {
    name: 'list_repositories',
    description:
      'Lists the repositories whose sites the user can see on their Plumbline dashboard: the ones they added themselves and every site of the GitHub repositories they have access to, with how each site stands now (checking, failing, with warnings, all clear, not answering or not checked yet).',
    inputSchema: { type: 'object', additionalProperties: false },
  },
  {
    name: 'get_domain',
    description:
      "Shows one of the user's domains: which checks run for it (or that all do), the ones switched off, and how its newest scan went.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { domain: DOMAIN },
      required: ['domain'],
    },
  },
  {
    name: 'get_report',
    description:
      "Shows a saved report of one of the user's domains: when it was scanned, how many checks passed, warned, failed and were skipped, and what each failing or warning check found. The newest report unless `report` names an older one (from list_reports).",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        domain: DOMAIN,
        report: {
          type: 'string',
          maxLength: 64,
          description: 'The id of an older report, from list_reports.',
        },
      },
      required: ['domain'],
    },
    outputSchema: REPORT_OUTPUT_SCHEMA,
    _meta: {
      ...viewMeta(REPORT_RESOURCE_URI, 'Reading the report…', 'Here it is'),
      ...WIDGET_CALLABLE,
    },
  },
  {
    name: 'list_reports',
    description:
      "Lists the saved reports of one of the user's domains, newest first, with their ids and counts.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { domain: DOMAIN },
      required: ['domain'],
    },
  },
  {
    name: 'scan_domain',
    description:
      "Says how to scan one of the user's domains: the Plumbline page that runs its checks in the browser and saves a report, and the CLI command that runs every check (TLS and mail included) on the user's own machine. The checks never run on the server, so this starts nothing by itself.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { domain: DOMAIN },
      required: ['domain'],
    },
  },
  {
    name: 'remove_domain',
    description:
      "Removes a domain from the user's list, with all of its saved reports.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { domain: DOMAIN },
      required: ['domain'],
    },
  },
  {
    name: 'configure_checks',
    description:
      "Chooses which checks run for one of the user's domains: `enable` and `disable` take check ids or group names (tls, owasp, seo, …), and `all` switches every check on first. Returns how many checks now run.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        domain: DOMAIN,
        all: {
          type: 'boolean',
          description:
            'Switch every check on before applying enable and disable.',
        },
        enable: {
          ...CHECK_NAMES,
          description: 'Check ids or group names to switch on.',
        },
        disable: {
          ...CHECK_NAMES,
          description: 'Check ids or group names to switch off.',
        },
      },
      required: ['domain'],
    },
  },
] as const;

/** The name of one of the tools. */
export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

/** The hints that describe a tool that only reads. */
const READS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** What a tool shows people and tells hosts about its effects. */
interface ToolPresentation {
  /** The name shown in a host's interface. */
  readonly title: string;
  /** The effect hints (see the MCP spec's `ToolAnnotations`). */
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
}

/**
 * The title and effect hints of every tool, in one place. `readOnlyHint` is
 * true exactly for the tools `oauth/scopes.ts` treats as reads (a test keeps
 * the two in step); removing a domain is the one destructive tool.
 */
const TOOL_PRESENTATION: Readonly<Record<ToolName, ToolPresentation>> = {
  list_checks: { title: 'List checks', annotations: READS },
  list_domains: { title: 'List domains', annotations: READS },
  list_repositories: { title: 'List repositories', annotations: READS },
  get_domain: { title: 'Show a domain', annotations: READS },
  get_report: { title: 'Show a report', annotations: READS },
  list_reports: { title: 'List reports', annotations: READS },
  scan_domain: { title: 'Scan a domain', annotations: READS },
  remove_domain: {
    title: 'Remove a domain',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  configure_checks: {
    title: 'Choose checks',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
};

/**
 * The tool catalogue advertised to clients: each definition with its title (both
 * as the tool's own `title` and in `annotations.title`, which older clients
 * read) and its effect hints.
 */
export const TOOLS = TOOL_DEFINITIONS.map((tool) => {
  const { title, annotations } = TOOL_PRESENTATION[tool.name];
  // What sign-in a call needs, tool by tool: ChatGPT asks for each tool to say
  // so even when the whole server asks the same of every caller. Written in
  // `_meta` as well because some MCP libraries drop unknown top-level fields.
  const securitySchemes = [
    { type: 'oauth2', scopes: [scopeForTool(tool.name)] },
  ] as const;
  return {
    ...tool,
    title,
    annotations: { title, ...annotations },
    securitySchemes,
    _meta: {
      ...('_meta' in tool ? tool._meta : {}),
      securitySchemes,
    },
  };
});

/** The advertised tool with this name, if there is one. */
export function toolNamed(name: string): (typeof TOOLS)[number] | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
