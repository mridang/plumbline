import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/origin-agent-cluster.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('origin-agent-cluster', () => {
  it('passes for ?1', async () => {
    expect(await runHint(hint, page({ 'origin-agent-cluster': '?1' }))).toEqual(
      [],
    );
  });

  it('recommends the header when absent', async () => {
    const problems = await runHint(hint, page({}));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Origin-Agent-Cluster: ?1');
  });

  it('warns on another value', async () => {
    const problems = await runHint(
      hint,
      page({ 'origin-agent-cluster': '?0' }),
    );
    expect(problems[0].message).toContain("'?1'");
  });
});
