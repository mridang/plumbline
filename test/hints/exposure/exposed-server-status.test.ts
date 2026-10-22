import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-server-status.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-server-status', () => {
  it('passes when server-status is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports an open Apache status page', async () => {
    const problems = await runHint(hint, {
      '/server-status': {
        body: '<html><body><h1>Apache Server Status for example.com</h1></body></html>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/server-status');
  });

  it('reports an open server-info page', async () => {
    const problems = await runHint(hint, {
      '/server-info': {
        body: '<html><body><h1>Apache Server Information</h1></body></html>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/server-info');
  });

  it('does not flag a SPA index.html returned at the path', async () => {
    expect(
      await runHint(hint, {
        '/server-status': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
        },
      }),
    ).toEqual([]);
  });
});
