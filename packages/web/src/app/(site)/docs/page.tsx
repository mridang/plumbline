import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { Badge } from '@/components/ui-app/badge';
import { CodeBlock } from '@/components/ui-app/code-block';
import { KeyValue } from '@/components/ui-app/key-value';
import { LinkButton } from '@/components/ui-app/link-button';
import { Section } from '@/components/ui-app/section';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { MCP_ADDRESS, WAYS_IN } from '@/components/landing/ways-in';
import { RULE_SET_DEFS } from '@/domain/checks/sets';
import { SITE_URL, SOURCE_URL } from '@/utils/site';

/** A public page: it may be indexed. */
export const metadata: Metadata = pageMetadata({
  title: 'Docs',
  description:
    'How to run Plumbline from a terminal, a coding agent or an assistant, the REST API, and the plumbline.yaml rules file with its JSON schema.',
  path: '/docs',
  index: true,
});

/** Where editors fetch the schema of the rules file. */
const SCHEMA_URL = `${SITE_URL}/schemas/plumbline.schema.json`;

/** The rules file as a repository would keep it, with the line that makes an editor check it. */
const RULES_EXAMPLE = `# yaml-language-server: $schema=${SCHEMA_URL}
extends: plumbline:recommended
rules:
  seo-viewport: error        # off, warn, error or on
  technical-lazy-loading: off
environments:
  preview:
    extends: plumbline:advanced
issues: error                # which findings open an issue: error, warning or off
dispatch: true               # send a repository_dispatch event after each run
`;

/**
 * The documentation: the ways to run the checks, the API, the MCP server and
 * the rules file. The same for everyone, so it may be indexed and kept.
 */
export default function DocsPage(): ReactElement {
  const ruleSets = RULE_SET_DEFS.filter((set) => set.kind !== 'section').map(
    (set) => set.id,
  );
  return (
    <>
      <PageHeader
        eyebrow="Docs"
        title="Run the checks your way"
        intro="From a terminal, a coding agent or an assistant; through the API; and with a rules file that says which checks matter for a repository."
      />
      <Container className="space-y-16 pt-10 pb-20">
        <Section
          id="ways-in"
          title="Ways to run it"
          description="One set of checks, however you reach it."
        >
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4">
            {WAYS_IN.map((way) => (
              <li
                key={way.title}
                className="flex flex-col rounded-card border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{way.title}</h3>
                  <Badge tone="info">{way.tag}</Badge>
                </div>
                <p className="mt-2 text-sm text-pretty text-muted">
                  {way.body}
                </p>
                <CodeBlock label={`${way.title}: command`} className="mt-4">
                  {way.snippet}
                </CodeBlock>
                <a
                  href={way.href}
                  className="focus-ring mt-4 inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent hover:underline"
                >
                  {way.more}
                  <span aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="api"
          title="REST API"
          description="Everything the site does for you is also an API, described in one OpenAPI file."
        >
          <KeyValue
            facts={[
              { label: 'Base', value: <code>{`${SITE_URL}/api`}</code> },
              {
                label: 'Description',
                value: (
                  <a
                    href={`${SOURCE_URL}/blob/master/packages/web/openapi.json`}
                    className="focus-ring text-accent underline underline-offset-4"
                  >
                    openapi.json
                  </a>
                ),
              },
              {
                label: 'Signing in',
                value:
                  'The site uses a session cookie. Assistants and other tools sign in through the OAuth flow behind the MCP server.',
              },
            ]}
          />
        </Section>

        <Section
          id="mcp"
          title="MCP server"
          description="Connect an assistant to your sites and their reports."
          actions={
            <LinkButton href="/connect" variant="outline" size="sm">
              Connect an assistant
            </LinkButton>
          }
        >
          <CodeBlock label="MCP server address">{MCP_ADDRESS}</CodeBlock>
        </Section>

        <Section
          id="rules"
          title="Rules file"
          description="Keep a plumbline.yaml in the root of a repository to choose which checks run and which findings open an issue. Without one, a site uses the recommended rules."
          actions={
            <LinkButton
              href="/schemas/plumbline.schema.json"
              variant="outline"
              size="sm"
            >
              JSON schema
            </LinkButton>
          }
        >
          <CodeBlock label="An example plumbline.yaml">
            {RULES_EXAMPLE}
          </CodeBlock>
          <p className="mt-3 max-w-2xl text-sm text-pretty text-muted">
            The first line makes an editor with the YAML language server check
            the file as you type and complete the names of the checks. The{' '}
            <Link
              href="/checks"
              className="focus-ring text-accent underline underline-offset-4"
            >
              checks page
            </Link>{' '}
            lists every id.
          </p>
          <div className="mt-6">
            <KeyValue
              facts={[
                {
                  label: 'File names',
                  value: (
                    <code>plumbline.yaml, plumbline.yml, plumbline.json</code>
                  ),
                },
                {
                  label: 'extends',
                  value: (
                    <>
                      A rule set, or a list of them:{' '}
                      {ruleSets.map((name, index) => (
                        <span key={name}>
                          {index > 0 ? ', ' : ''}
                          <code>{name}</code>
                        </span>
                      ))}
                      , and for every section on the checks page{' '}
                      <code>plumbline:&lt;section&gt;/recommended</code>,{' '}
                      <code>/advanced</code> and <code>/experimental</code>.
                    </>
                  ),
                },
                {
                  label: 'rules',
                  value:
                    'A check id and a level: off, warn, error or on (keep the check’s own severity).',
                },
                {
                  label: 'environments',
                  value:
                    'Changes for one kind of deployment, production or preview, with their own extends and rules.',
                },
                {
                  label: 'issues',
                  value:
                    'Which findings open a GitHub issue on production: error (the default), warning or off.',
                },
                {
                  label: 'dispatch',
                  value:
                    'Send a repository_dispatch event after each run, for a workflow to pick up.',
                },
              ]}
            />
          </div>
          <p className="mt-4 max-w-2xl text-sm text-pretty text-muted">
            A mistake in the file never stops a run: what can be read is used,
            and each mistake is reported so you can fix it.
          </p>
        </Section>
      </Container>
    </>
  );
}
