import { describe, expect, it } from '@jest/globals';

import { PROMPT_DEFINITIONS, getPrompt } from '@/domain/mcp/prompts';
import { RpcError } from '@/lib/mcp';
import { TOOLS } from '@/domain/mcp/tool-definitions';

/** The opening message's text. */
function textOf(name: string, args?: unknown): string {
  return getPrompt(name, args).messages[0]?.content.text ?? '';
}

/** The JSON-RPC code `getPrompt` refuses with, or undefined when it does not. */
function refusalCode(name: unknown, args: unknown): number | undefined {
  try {
    getPrompt(name, args);
    return undefined;
  } catch (error) {
    return error instanceof RpcError ? error.code : undefined;
  }
}

describe('PROMPT_DEFINITIONS', () => {
  it('lists the prompts in the order a host should show them', () => {
    expect(PROMPT_DEFINITIONS.map((p) => p.name)).toEqual([
      'audit-domain',
      'my-domains',
      'choose-checks',
    ]);
  });

  it('give every prompt a title, a description and described arguments', () => {
    for (const prompt of PROMPT_DEFINITIONS) {
      expect(prompt.title).not.toBe('');
      expect(prompt.description).not.toBe('');
      for (const argument of prompt.arguments) {
        expect(argument.description).not.toBe('');
      }
    }
  });

  it('have unique, slash-command-friendly names', () => {
    const names = PROMPT_DEFINITIONS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it('only send the assistant to tools that exist', () => {
    const tools = TOOLS.map((t) => t.name) as readonly string[];
    const texts = [
      textOf('audit-domain', { domain: 'example.com' }),
      textOf('my-domains'),
      textOf('choose-checks', { domain: 'example.com', focus: 'tls' }),
      textOf('choose-checks', { domain: 'example.com' }),
    ];
    const mentioned = texts.flatMap((text) =>
      [...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map((m) => m[0]),
    );
    expect(mentioned.length).toBeGreaterThan(0);
    for (const name of mentioned) {
      expect(tools).toContain(name);
    }
  });
});

describe('getPrompt', () => {
  it('names the domain to audit', () => {
    expect(textOf('audit-domain', { domain: 'example.com' })).toContain(
      'report for example.com with get_report',
    );
  });

  it('trims the domain it is given', () => {
    expect(textOf('audit-domain', { domain: '  example.com  ' })).toBe(
      textOf('audit-domain', { domain: 'example.com' }),
    );
  });

  it('works without arguments for a prompt that needs none', () => {
    expect(textOf('my-domains', {})).toBe(textOf('my-domains'));
  });

  it('asks for an overview, worst first', () => {
    expect(textOf('my-domains')).toContain('worst first');
  });

  it('keeps the checks about the focus the person gave', () => {
    expect(
      textOf('choose-checks', { domain: 'example.com', focus: 'security' }),
    ).toContain('keep the ones about security');
  });

  it('suggests a set when no focus is given', () => {
    expect(textOf('choose-checks', { domain: 'example.com' })).toContain(
      'suggest a sensible set',
    );
  });

  it('ignores a blank optional argument', () => {
    expect(textOf('choose-checks', { domain: 'a.com', focus: '   ' })).toBe(
      textOf('choose-checks', { domain: 'a.com' }),
    );
  });

  it('treats a null value, which some clients send for a skipped field, as left out', () => {
    expect(textOf('choose-checks', { domain: 'a.com', focus: null })).toBe(
      textOf('choose-checks', { domain: 'a.com' }),
    );
  });

  it('treats null arguments as none', () => {
    expect(textOf('my-domains', null)).toBe(textOf('my-domains'));
  });

  it('answers as a single user message', () => {
    const result = getPrompt('my-domains', undefined);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe('user');
  });

  it('describes the result as the prompt is described', () => {
    expect(getPrompt('my-domains', undefined).description).toBe(
      PROMPT_DEFINITIONS[1]?.description,
    );
  });

  it('repeats only the start of an absurdly long prompt name', () => {
    expect(() => getPrompt('x'.repeat(100_000), {})).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/^.{0,400}$/s),
      }),
    );
  });

  it('names the missing argument', () => {
    expect(() => getPrompt('audit-domain', {})).toThrow(
      'Prompt audit-domain needs `domain`.',
    );
  });

  it.each([
    ['an unknown prompt', 'nope', {}],
    ['no name', undefined, {}],
    ['a missing required argument', 'audit-domain', {}],
    ['a blank required argument', 'audit-domain', { domain: ' ' }],
    ['arguments that are not an object', 'my-domains', ['domain']],
    ['arguments that are text', 'my-domains', 'domain'],
    ['an argument that is not a string', 'choose-checks', { domain: 3 }],
  ])('refuses %s as bad parameters', (_label, name, args) => {
    expect(refusalCode(name, args)).toBe(-32602);
  });
});
