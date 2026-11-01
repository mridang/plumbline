import { describe, expect, it } from '@jest/globals';

import { FixPromptBox } from '@/components/scan/fix-prompt-box';
import type { HintOutcome } from '@/domain/scan/engine';
import { html } from '../render';

const hint = (status: HintOutcome['status']): HintOutcome => ({
  id: 'a',
  name: 'Check a',
  description: 'About a',
  section: 's',
  sectionTitle: 'S',
  sectionOrder: 1,
  groups: [],
  origins: [],
  status,
  findings: [],
});

describe('FixPromptBox', () => {
  it('draws nothing when nothing failed or warned', () => {
    expect(
      html(
        <FixPromptBox
          scan={{ finalUrl: 'https://e.com/', hints: [hint('passed')] }}
        />,
      ),
    ).toBe('');
  });

  it('shows the prompt in a read-only box with a copy button', () => {
    const out = html(
      <FixPromptBox
        scan={{ finalUrl: 'https://e.com/', hints: [hint('failed')] }}
        repository="mridang/site"
      />,
    );
    expect(out).toContain('Fix these with your coding assistant');
    expect(out).toContain('readOnly');
    expect(out).toContain('Fix the problems plumbline found on https://e.com/');
    expect(out).toContain('mridang/site');
    expect(out).toContain('Copy the prompt');
  });
});
