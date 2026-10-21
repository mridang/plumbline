import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-auth-md.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/auth.md': { headers: { 'content-type': 'text/markdown' }, body: '# Auth' },
};

describe('agent-auth-md', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
