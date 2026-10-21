import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-a2a-agent-card.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/agent-card.json': json({
    name: 'a',
    description: 'd',
    version: '1',
    url: 'https://example.com',
    capabilities: {},
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [],
    supportedInterfaces: [
      {
        url: 'https://example.com/a2a',
        protocolBinding: 'JSONRPC',
        protocolVersion: '1.0',
      },
    ],
  }),
};

describe('agent-a2a-agent-card', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
