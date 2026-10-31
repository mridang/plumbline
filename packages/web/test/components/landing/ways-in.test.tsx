import { describe, expect, it } from '@jest/globals';

import {
  CLI_SCAN,
  MCP_ADDRESS,
  SKILL_INSTALL,
  WAYS_IN,
  WaysIn,
} from '@/components/landing/ways-in';
import { html } from '../render';

describe('WAYS_IN', () => {
  it('installs the skill from this repository', () => {
    expect(SKILL_INSTALL).toBe('npx skills add mridang/webhint-hints');
  });

  it('runs the CLI from npm', () => {
    expect(CLI_SCAN).toMatch(/^npx @mridang\/plumbline scan /);
  });

  it('connects assistants to the MCP endpoint of this site', () => {
    expect(MCP_ADDRESS).toBe('https://plumbline.apps.mrida.ng/mcp');
  });

  it('covers the CLI, the skill, MCP, webhint, Lighthouse and Docker', () => {
    expect(WAYS_IN.map((way) => way.tag)).toEqual([
      'CLI',
      'Skill',
      'MCP',
      'Hints',
      'Plugin',
      'Image',
    ]);
  });
});

describe('WaysIn', () => {
  const out = html(<WaysIn />);

  it('shows every way’s command and link', () => {
    for (const way of WAYS_IN) {
      expect(out).toContain(`<code>${way.snippet}</code>`);
      expect(out).toContain(`href="${way.href}"`);
    }
  });

  it('is the section the header’s “Developers” link points to', () => {
    expect(out).toContain('id="developers"');
  });
});
