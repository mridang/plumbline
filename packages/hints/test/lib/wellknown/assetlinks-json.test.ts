import { describe, expect, it } from '@jest/globals';
import { validateAssetlinksJson } from '../../../src/lib/wellknown/assetlinks-json.js';

const msgs = (v: unknown) =>
  validateAssetlinksJson(JSON.stringify(v)).map((i) => i.message);

const androidStatement = {
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: 'com.example',
    sha256_cert_fingerprints: ['AA:BB:CC'],
  },
};

describe('validateAssetlinksJson', () => {
  it('accepts an android_app statement', () => {
    expect(validateAssetlinksJson(JSON.stringify([androidStatement]))).toEqual(
      [],
    );
  });

  it('accepts a web statement', () => {
    expect(
      msgs([
        {
          relation: ['delegate_permission/common.get_login_creds'],
          target: { namespace: 'web', site: 'https://example.com' },
        },
      ]),
    ).toEqual([]);
  });

  it('reports invalid JSON', () => {
    expect(validateAssetlinksJson('x')[0].message).toContain('not valid JSON');
  });

  it('reports a non-array root', () => {
    expect(msgs({})).toContain(
      'The top-level value must be a JSON array of statements.',
    );
  });

  it('warns on an empty array', () => {
    expect(msgs([])).toContain('The file contains no statements.');
  });

  it('reports a missing relation array', () => {
    expect(
      msgs([{ target: { namespace: 'web', site: 'https://a.com' } }]),
    ).toContain('statement[0].relation must be a non-empty array of strings.');
  });

  it('reports an android_app without package_name', () => {
    expect(
      msgs([
        {
          relation: ['r'],
          target: { namespace: 'android_app', sha256_cert_fingerprints: ['A'] },
        },
      ]),
    ).toContain(
      "statement[0].target is an android_app but has no 'package_name'.",
    );
  });

  it('reports an android_app without fingerprints', () => {
    expect(
      msgs([
        {
          relation: ['r'],
          target: { namespace: 'android_app', package_name: 'com.x' },
        },
      ]),
    ).toContain(
      "statement[0].target is an android_app but has no 'sha256_cert_fingerprints'.",
    );
  });

  it('reports a web target without a site', () => {
    expect(msgs([{ relation: ['r'], target: { namespace: 'web' } }])).toContain(
      "statement[0].target is a web target but has no 'site'.",
    );
  });

  it('reports an unknown namespace', () => {
    expect(msgs([{ relation: ['r'], target: { namespace: 'ios' } }])).toContain(
      "statement[0].target.namespace must be 'android_app' or 'web'.",
    );
  });
});
