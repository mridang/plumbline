import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-acp.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/acp.json': json({
    protocol: { name: 'acp', version: '2025-09-29' },
    transports: ['rest'],
    capabilities: {},
    api_base_url: 'https://example.com/acp',
  }),
};

describe('agent-acp', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].resource.endsWith('/.well-known/acp.json')).toBe(true);
    expect(problems[0].sourceCode).toContain('api_base_url');
  });
});
