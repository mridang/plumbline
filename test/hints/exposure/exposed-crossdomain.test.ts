import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-crossdomain.js';
import { runHint } from '../../helpers/run-hint.js';

describe('exposed-crossdomain', () => {
  it('passes when crossdomain.xml is not served', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a wildcard policy', async () => {
    const problems = await runHint(hint, {
      '/crossdomain.xml': {
        headers: { 'content-type': 'text/xml' },
        body: '<?xml version="1.0"?><cross-domain-policy><allow-access-from domain="*"/></cross-domain-policy>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/crossdomain.xml');
  });

  it('passes for a restrictive policy', async () => {
    expect(
      await runHint(hint, {
        '/crossdomain.xml': {
          headers: { 'content-type': 'text/xml' },
          body: '<cross-domain-policy><allow-access-from domain="example.com"/></cross-domain-policy>',
        },
      }),
    ).toEqual([]);
  });

  it('does not flag a SPA index.html returned at the path', async () => {
    expect(
      await runHint(hint, {
        '/crossdomain.xml': {
          body: '<!doctype html><html lang="en"><head><title>a</title></head><body>domain="*"</body></html>',
        },
      }),
    ).toEqual([]);
  });
});
