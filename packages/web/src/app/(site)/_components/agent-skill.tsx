import type { ReactElement } from 'react';

import { Heading } from '@/components/ui/layout';
import { CopyField } from '@/components/ui/copy-field';

/** The command that installs the plumbline skill into a coding agent. */
export const SKILL_INSTALL = 'npx skills add mridang/webhint-hints';

/** The command the skill runs: every check, with Node and a real Chrome. */
export const CLI_SCAN = 'npx @mridang/plumbline scan example.com';

/** Where the skill is written down. */
export const SKILL_SOURCE =
  'https://github.com/mridang/webhint-hints/blob/master/skills/plumbline/SKILL.md';

/**
 * How to use plumbline from a coding agent: install the agent skill, which
 * teaches the agent to run the plumbline CLI and explain what it finds. The CLI
 * runs every check, including the ones a browser has to skip.
 */
export function AgentSkill(): ReactElement {
  return (
    <section aria-label="Use it from your coding agent" className="mt-16">
      <Heading as="h2" variant="h2">
        Use it from your coding agent
      </Heading>
      <p className="mt-3 max-w-2xl text-muted">
        Install the plumbline skill in Claude Code, Cursor, Codex or any agent
        that reads skills. Then ask it to “audit my site” and it runs every
        check with the plumbline CLI, including the ones a browser has to skip,
        and explains how to fix what it finds.{' '}
        <a href={SKILL_SOURCE} className="focus-ring text-accent underline">
          Read the skill
        </a>
        .
      </p>
      <div className="mt-5 grid gap-3">
        <CopyField value={SKILL_INSTALL} label="Install the skill" />
        <p className="text-sm text-subtle">Or run the checks yourself:</p>
        <CopyField value={CLI_SCAN} label="Run the CLI" />
      </div>
    </section>
  );
}
