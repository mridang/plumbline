import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/nodeinfo.js';
import { runHint } from '../../helpers/run-hint.js';
import { HTTP_SCHEME } from '../../helpers/data.js';

describe('nodeinfo', () => {
  it('is silent when the document is absent', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports a valid links document', async () => {
    const problems = await runHint(hint, {
      '/.well-known/nodeinfo': {
        headers: { 'content-type': 'application/json' },
        body: `{"links":[{"rel":"${HTTP_SCHEME}nodeinfo.diaspora.software/ns/schema/2.1","href":"https://x.test/ni"}]}`,
      },
    });
    expect(problems[0].message).toContain('NodeInfo');
    expect(problems[0].resource).toContain('/.well-known/nodeinfo');
  });

  it('warns on a malformed document', async () => {
    const problems = await runHint(hint, {
      '/.well-known/nodeinfo': {
        headers: { 'content-type': 'application/json' },
        body: '{"links":[]}',
      },
    });
    expect(problems[0].message).toContain('links');
  });
});
