import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-directory-listing.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-directory-listing', () => {
  it('passes when directories return 404', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports an Apache autoindex listing', async () => {
    const problems = await runHint(hint, {
      '/uploads/': {
        body: '<html><head><title>Index of /uploads</title></head><body><h1>Index of /uploads</h1></body></html>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/uploads/');
  });

  it('does not flag a SPA index.html returned for a directory', async () => {
    expect(
      await runHint(hint, {
        '/images/': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });
});
