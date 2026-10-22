import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-api-catalog.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

const routes: Routes = {
  '/.well-known/api-catalog': json({
    linkset: [
      {
        anchor: 'https://example.com/api',
        'service-desc': [{ href: '/o.json' }],
      },
    ],
  }),
};

describe('agent-api-catalog', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource.endsWith('/.well-known/api-catalog')).toBe(
      true,
    );
    expect(problems[0].sourceCode).toContain('service-desc');
  });

  it('shows the fetched document when it is invalid', async () => {
    const problems = await runHint(hint, {
      '/.well-known/api-catalog': json({ linkset: [{ anchor: 'x' }] }),
    });
    expect(problems[0].resource.endsWith('/.well-known/api-catalog')).toBe(
      true,
    );
    expect(problems[0].sourceCode).toContain('"anchor": "x"');
  });
});
