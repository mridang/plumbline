import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/wellknown/assetlinks-json.js';
import { runHint } from '../../helpers/run-hint.js';

const PATH = '/.well-known/assetlinks.json';

const serve = (
  body: string,
  type = 'application/json; charset=utf-8',
  status = 200,
) => ({ [PATH]: { status, headers: { 'content-type': type }, body } });

const valid = JSON.stringify([
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.example',
      sha256_cert_fingerprints: ['AA:BB:CC'],
    },
  },
]);

describe('assetlinks-json', () => {
  it('passes for a valid file', async () => {
    expect(await runHint(hint, serve(valid))).toEqual([]);
  });

  it('reports a missing file', async () => {
    const problems = await runHint(hint, {});
    expect(problems[0].message).toContain('was not found');
    expect(problems[0].resource).toContain(PATH);
  });

  it('reports a wrong content type', async () => {
    const problems = await runHint(hint, serve(valid, 'text/plain'));
    expect(problems.map((p) => p.message).join()).toContain(
      "served as 'text/plain'",
    );
  });

  it('reports invalid JSON', async () => {
    const problems = await runHint(hint, serve('nope'));
    expect(problems.map((p) => p.message).join()).toContain('not valid JSON');
  });

  it('reports a malformed statement', async () => {
    const problems = await runHint(
      hint,
      serve(
        JSON.stringify([{ relation: ['r'], target: { namespace: 'web' } }]),
      ),
    );
    expect(problems.map((p) => p.message).join()).toContain(
      "is a web target but has no 'site'",
    );
  });
});
