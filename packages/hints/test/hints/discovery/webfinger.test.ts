import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/webfinger.js';
import { runHint } from '../../helpers/run-hint.js';

describe('webfinger', () => {
  it('is silent when the endpoint is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a conformant 400 (resource required)', async () => {
    const problems = await runHint(hint, {
      '/.well-known/webfinger': { status: 400, body: '' },
    });
    expect(problems[0].message).toContain('WebFinger endpoint');
    expect(problems[0].resource).toContain('/.well-known/webfinger');
  });

  it('reports a valid JRD on 200', async () => {
    const problems = await runHint(hint, {
      '/.well-known/webfinger': {
        headers: { 'content-type': 'application/jrd+json' },
        body: '{"subject":"acct:a@x.test"}',
      },
    });
    expect(problems[0].message).toContain('JSON Resource Descriptor');
  });

  it('warns on a wrong content type', async () => {
    const problems = await runHint(hint, {
      '/.well-known/webfinger': {
        headers: { 'content-type': 'text/html' },
        body: '{}',
      },
    });
    expect(problems[0].message).toContain('jrd+json');
  });
});
