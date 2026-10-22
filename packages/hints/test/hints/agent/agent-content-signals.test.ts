import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-content-signals.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/robots.txt': {
    headers: { 'content-type': 'text/plain' },
    body: 'Content-Signal: ai-train=no, search=yes',
  },
};

describe('agent-content-signals', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource.endsWith('/robots.txt')).toBe(true);
    expect(problems[0].sourceCode).toContain('Content-Signal: ai-train=no');
  });

  it('shows the offending Content-Signal line', async () => {
    const problems = await runHint(hint, {
      '/robots.txt': {
        headers: { 'content-type': 'text/plain' },
        body: 'Content-Signal: ai-train=maybe',
      },
    });
    expect(problems[0].resource.endsWith('/robots.txt')).toBe(true);
    expect(problems[0].sourceCode).toBe('Content-Signal: ai-train=maybe');
  });
});
