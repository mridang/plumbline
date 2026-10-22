import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/host-meta.js';
import { runHint } from '../../helpers/run-hint.js';

describe('host-meta', () => {
  it('is silent when the document is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a valid XRD document', async () => {
    const problems = await runHint(hint, {
      '/.well-known/host-meta': {
        headers: { 'content-type': 'application/xrd+xml' },
        body: '<?xml version="1.0"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"></XRD>',
      },
    });
    expect(problems[0].message).toContain('XRD');
    expect(problems[0].resource).toContain('/.well-known/host-meta');
  });

  it('warns when the body is neither XRD nor JSON', async () => {
    const problems = await runHint(hint, {
      '/.well-known/host-meta': {
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      },
    });
    expect(problems[0].message).toContain('XRD');
  });
});
