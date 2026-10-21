import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-x402.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = { '/api': { status: 402 } };

describe('agent-x402', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].resource.endsWith('/api')).toBe(true);
    expect(problems[0].sourceCode).toContain('402 Payment Required');
    expect(problems[0].codeLanguage).toBe('http');
  });
});
