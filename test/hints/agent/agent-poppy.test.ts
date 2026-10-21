import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-poppy.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/poppy.json': json({
    protocol_version: '0.1',
    organization: { name: 'E', domain: '127.0.0.1' },
    web: {},
  }),
};

describe('agent-poppy', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
