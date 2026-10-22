import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/sourcemap.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('sourcemap', () => {
  it('passes when neither header is present', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('reports a SourceMap header', async () => {
    const problems = await runHint(hint, page({ sourcemap: '/app.js.map' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('SourceMap: /app.js.map');
  });

  it('reports the legacy X-SourceMap header', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-sourcemap': '/app.js.map' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('X-SourceMap');
  });
});
