import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-oauth-discovery.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/openid-configuration': json({ issuer: 'https://example.com' }),
};

describe('agent-oauth-discovery', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(
      problems[0].resource.endsWith('/.well-known/openid-configuration'),
    ).toBe(true);
    expect(problems[0].sourceCode).toContain('"issuer"');
  });
});
