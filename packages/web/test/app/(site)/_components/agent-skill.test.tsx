import { describe, expect, it } from '@jest/globals';

import {
  AgentSkill,
  CLI_SCAN,
  SKILL_INSTALL,
  SKILL_SOURCE,
} from '@/app/(site)/_components/agent-skill';
import { html } from '../../../components/render';

describe('AgentSkill', () => {
  const out = html(<AgentSkill />);

  it('installs the skill from this repository', () => {
    expect(SKILL_INSTALL).toBe('npx skills add mridang/webhint-hints');
    expect(out).toContain(`>${SKILL_INSTALL}</code>`);
  });

  it('offers the CLI the skill runs', () => {
    expect(CLI_SCAN).toMatch(/^npx @mridang\/plumbline scan /);
    expect(out).toContain(`>${CLI_SCAN}</code>`);
  });

  it('links to the skill itself', () => {
    expect(out).toContain(`href="${SKILL_SOURCE}"`);
  });

  it('names the section for assistive technology', () => {
    expect(out).toContain('aria-label="Use it from your coding agent"');
  });
});
