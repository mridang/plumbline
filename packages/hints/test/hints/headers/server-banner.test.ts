import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/server-banner.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('server-banner', () => {
  it('passes for a bare product name', async () => {
    expect(await runHint(hint, page({ server: 'nginx' }))).toEqual([]);
  });

  it('passes when absent', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('warns when a version is disclosed', async () => {
    const problems = await runHint(hint, page({ server: 'nginx/1.25.3' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('Server: nginx/1.25.3');
  });
});
