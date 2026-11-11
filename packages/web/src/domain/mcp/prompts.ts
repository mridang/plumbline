/**
 * @packageDocumentation
 *
 * The prompts the MCP server offers. Hosts show them as slash commands (or a
 * menu of starting points), so a person can begin with "Audit a domain"
 * instead of working out which tools to ask for. A prompt is only a message:
 * it tells the assistant what the person wants and which tools to reach for,
 * and the assistant does the rest with the same tools it always has.
 *
 * Prompt arguments are always strings (the protocol has no other type), so an
 * optional one that is left out, blank or sent as `null` (what some clients put
 * for a field the person skipped) is simply not mentioned.
 */

import { ERROR_INVALID_PARAMS, RpcError } from '@/lib/mcp';

/** One argument a prompt accepts. */
export interface PromptArgument {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly required: boolean;
}

/** A prompt as `prompts/list` describes it. */
export interface PromptDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly arguments: readonly PromptArgument[];
}

/** A prompt as `prompts/get` returns it: the message that starts the conversation. */
export interface PromptResult {
  readonly description: string;
  readonly messages: readonly {
    readonly role: 'user';
    readonly content: { readonly type: 'text'; readonly text: string };
  }[];
}

/** What a prompt needs: its definition, and how it turns arguments into the opening message. */
interface Prompt {
  readonly definition: PromptDefinition;
  readonly text: (args: Readonly<Record<string, string>>) => string;
}

/** The text of an argument, or nothing when it was left out or is blank. */
function given(
  args: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const value = args[name]?.trim();
  return value || undefined;
}

/** Every prompt the server offers, in the order a host should list them. */
const PROMPTS: readonly Prompt[] = [
  {
    definition: {
      name: 'audit-domain',
      title: 'Audit a domain',
      description:
        "Go through a domain's newest report: what failed, what to fix first, and how.",
      arguments: [
        {
          name: 'domain',
          title: 'Domain',
          description: 'The domain to audit, such as example.com.',
          required: true,
        },
      ],
    },
    text: (args) =>
      `Look at the newest Plumbline report for ${given(args, 'domain') ?? ''} with get_report. ` +
      'Explain what failed and warned, grouped by what it is about, say which to fix first and why, ' +
      'and show the header, record or markup to change for each. If there is no report yet, use scan_domain to tell me how to run one.',
  },
  {
    definition: {
      name: 'my-domains',
      title: 'How are my domains doing?',
      description:
        'A short overview of every domain and how its newest scan went.',
      arguments: [],
    },
    text: () =>
      'List my Plumbline domains with list_domains and tell me in a few lines how each one is doing, worst first.',
  },
  {
    definition: {
      name: 'choose-checks',
      title: 'Choose the checks for a domain',
      description:
        'Pick which groups of checks run for a domain, such as only security headers and TLS.',
      arguments: [
        {
          name: 'domain',
          title: 'Domain',
          description: 'The domain to set up, such as example.com.',
          required: true,
        },
        {
          name: 'focus',
          title: 'Focus',
          description:
            "What matters for it, such as 'security' or 'SEO and social cards'.",
          required: false,
        },
      ],
    },
    text: (args) => {
      const focus = given(args, 'focus');
      return (
        `Help me choose which Plumbline checks run for ${given(args, 'domain') ?? ''}. ` +
        'Use list_checks to see the groups, ' +
        (focus
          ? `keep the ones about ${focus}, `
          : 'suggest a sensible set, ') +
        'and switch them with configure_checks once I agree.'
      );
    },
  },
];

/** What `prompts/list` returns: every prompt's definition. */
export const PROMPT_DEFINITIONS: readonly PromptDefinition[] = PROMPTS.map(
  (prompt) => prompt.definition,
);

/**
 * Build a prompt's opening message.
 * @param name - Which prompt.
 * @param rawArguments - The arguments the caller gave, if any.
 * @throws {RpcError} `-32602` if the prompt does not exist, if the arguments
 *   are not an object of strings, or if a required one is missing or blank.
 */
export function getPrompt(name: unknown, rawArguments: unknown): PromptResult {
  const prompt = PROMPTS.find((p) => p.definition.name === name);
  if (!prompt) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Unknown prompt: ${typeof name === 'string' ? name.slice(0, 120) : 'no name given'}. The prompts are ${PROMPT_DEFINITIONS.map((p) => p.name).join(', ')}.`,
    );
  }
  const args = stringArguments(rawArguments);
  const missing = prompt.definition.arguments.filter(
    (argument) => argument.required && given(args, argument.name) === undefined,
  );
  if (missing.length > 0) {
    const names = missing.map((m) => `\`${m.name}\``).join(' and ');
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Prompt ${prompt.definition.name} needs ${names}.`,
      { prompt: prompt.definition.name, missing: missing.map((m) => m.name) },
    );
  }
  return {
    description: prompt.definition.description,
    messages: [
      { role: 'user', content: { type: 'text', text: prompt.text(args) } },
    ],
  };
}

/**
 * The arguments as a record of strings, or a refusal if they are anything else.
 * A `null` value counts as left out.
 */
function stringArguments(raw: unknown): Readonly<Record<string, string>> {
  if (raw === undefined || raw === null) {
    return {};
  }
  const entries =
    typeof raw === 'object' && !Array.isArray(raw)
      ? Object.entries(raw).filter(([, value]) => value !== null)
      : undefined;
  if (!entries || entries.some(([, value]) => typeof value !== 'string')) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      'Prompt `arguments` must be an object whose values are strings.',
    );
  }
  return Object.fromEntries(entries);
}
