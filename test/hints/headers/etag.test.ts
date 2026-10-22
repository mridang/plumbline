import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/etag.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('etag', () => {
  it('passes for an opaque tag', async () => {
    expect(await runHint(hint, page({ etag: '"abc123"' }))).toEqual([]);
  });

  it('warns on an inode-size-mtime value', async () => {
    const problems = await runHint(hint, page({ etag: '"12345-1b6-5e0a"' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('ETag: "12345-1b6-5e0a"');
  });
});
