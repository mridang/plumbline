import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/observe-browsing-topics.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('observe-browsing-topics', () => {
  it('is silent when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('reports Topics API participation for ?1', async () => {
    const problems = await runHint(
      hint,
      page({ 'observe-browsing-topics': '?1' }),
    );
    expect(problems[0].message).toContain('Topics API');
  });

  it('warns on any other value', async () => {
    const problems = await runHint(
      hint,
      page({ 'observe-browsing-topics': '?0' }),
    );
    expect(problems[0].message).toContain("'?1'");
  });
});
