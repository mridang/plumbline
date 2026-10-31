import type { ReactElement, ReactNode } from 'react';

import { Container, Eyebrow } from '@/components/ui/layout';
import { SITE_URL, SOURCE_URL } from '@/utils/site';

/** The command that installs the plumbline skill into a coding agent. */
export const SKILL_INSTALL = 'npx skills add mridang/webhint-hints';

/** The command that runs every check from a terminal. */
export const CLI_SCAN = 'npx @mridang/plumbline scan example.com';

/** The address an assistant connects to. */
export const MCP_ADDRESS = `${SITE_URL}/mcp`;

/** One way to run the checks, as a card. */
export interface WayIn {
  readonly title: string;
  readonly body: string;
  /** The command or setting to start with. */
  readonly snippet: string;
  /** Where to read more. */
  readonly href: string;
  readonly more: string;
  /** A short tag for the card's corner. */
  readonly tag: string;
}

/** The ways to run plumbline besides this page, in the order people reach for them. */
export const WAYS_IN: readonly WayIn[] = [
  {
    title: 'Command line',
    tag: 'CLI',
    body: 'Every check, with Node and a real Chrome, including the TLS, DNS and mail checks a browser cannot run. Text, JSON or an HTML report, and an exit code that can fail a CI job.',
    snippet: `${CLI_SCAN} --fail-on warning`,
    href: `${SOURCE_URL}/tree/master/packages/cli`,
    more: 'CLI reference',
  },
  {
    title: 'Coding agents',
    tag: 'Skill',
    body: 'Install the plumbline skill in Claude Code, Cursor, Codex or any agent that reads skills, then ask it to audit your site: it runs the CLI and explains every fix. In Claude Code it is also a plugin with an audit command.',
    snippet: SKILL_INSTALL,
    href: `${SOURCE_URL}/tree/master/packages/skills`,
    more: 'Skills and plugin',
  },
  {
    title: 'AI assistants',
    tag: 'MCP',
    body: 'Connect ChatGPT, Claude or any MCP client to your domains and their reports. Ask what failed, what to fix first, or which checks to switch on.',
    snippet: MCP_ADDRESS,
    href: '/connect',
    more: 'Connect an assistant',
  },
  {
    title: 'webhint',
    tag: 'Hints',
    body: 'Add the checks to an existing webhint setup as extra hints, grouped by source (Observatory, OWASP, internet.nl and more), with a report formatter that shows the fixes.',
    snippet: 'npm install --save-dev hint @mridang/webhint-hint-extra',
    href: `${SOURCE_URL}/tree/master/packages/hints`,
    more: 'Hints and groups',
  },
  {
    title: 'Lighthouse',
    tag: 'Plugin',
    body: 'Run the checks as a Lighthouse plugin, next to performance and accessibility, in the reports your team already reads.',
    snippet:
      'npx lighthouse https://example.com --plugins=lighthouse-plugin-webhint-extra',
    href: `${SOURCE_URL}/tree/master/packages/lighthouse`,
    more: 'Plugin setup',
  },
  {
    title: 'Docker',
    tag: 'Image',
    body: 'A small HTTP server with Chromium that scans a URL and answers with JSON, for end-to-end tests in any language. Multi-arch, released with the packages.',
    snippet: 'docker run --rm -p 8080:8080 mridang/webhint-hints',
    href: `${SOURCE_URL}/tree/master/packages/docker`,
    more: 'Image and API',
  },
];

/** A link that leaves for another site, or stays on this one. */
function MoreLink({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>): ReactElement {
  return (
    <a
      href={href}
      className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
    >
      {children}
      <span aria-hidden="true">→</span>
    </a>
  );
}

/**
 * Where else the checks run: the CLI, coding agents, AI assistants, webhint,
 * Lighthouse and Docker, each with the command to start with and a link to
 * its documentation.
 */
export function WaysIn(): ReactElement {
  return (
    <section
      id="developers"
      aria-labelledby="developers-heading"
      className="scroll-mt-20 border-y border-line bg-surface py-24"
    >
      <Container className="max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>For developers</Eyebrow>
          <h2
            id="developers-heading"
            className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
          >
            Run the same checks wherever you work
          </h2>
          <p className="mt-4 text-lg text-muted">
            One set of checks, six ways in: from a terminal, a CI job, your
            coding agent, your assistant, or the tools you already use.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WAYS_IN.map((way) => (
            <li
              key={way.title}
              className="flex flex-col rounded-card border border-line bg-paper/60 p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  {way.title}
                </h3>
                <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-xs text-subtle">
                  {way.tag}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {way.body}
              </p>
              <pre className="mt-5 overflow-x-auto rounded-control bg-night px-4 py-3 font-mono text-xs leading-relaxed text-on-night">
                <code>{way.snippet}</code>
              </pre>
              <div className="mt-auto pt-5">
                <MoreLink href={way.href}>{way.more}</MoreLink>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
