import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-ai-bot-rules.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/robots.txt': { body: 'User-agent: GPTBot\nDisallow: /' },
};

describe('agent-ai-bot-rules', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
