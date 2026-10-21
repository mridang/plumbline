import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-markdown-negotiation.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/': (req) =>
    req.headers.accept === 'text/markdown'
      ? { headers: { 'content-type': 'text/markdown' }, body: '# hi' }
      : { headers: { 'content-type': 'text/html' }, body: '' },
};

describe('agent-markdown-negotiation', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource.endsWith('/')).toBe(true);
    expect(problems[0].sourceCode).toContain('Content-Type: text/markdown');
    expect(problems[0].codeLanguage).toBe('http');
  });
});
