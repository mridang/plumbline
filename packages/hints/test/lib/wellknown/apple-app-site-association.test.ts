import { describe, expect, it } from '@jest/globals';
import { validateAppleAppSiteAssociation } from '../../../src/lib/wellknown/apple-app-site-association.js';

const msgs = (v: unknown) =>
  validateAppleAppSiteAssociation(JSON.stringify(v)).map((i) => i.message);

describe('validateAppleAppSiteAssociation', () => {
  it('accepts modern applinks with appIDs and components', () => {
    expect(
      validateAppleAppSiteAssociation(
        JSON.stringify({
          applinks: {
            details: [
              { appIDs: ['ABCDE.com.example'], components: [{ '/': '/*' }] },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('accepts legacy applinks with appID and paths', () => {
    expect(
      msgs({
        applinks: {
          apps: [],
          details: [{ appID: 'ABCDE.com.example', paths: ['*'] }],
        },
      }),
    ).toEqual([]);
  });

  it('accepts webcredentials and appclips', () => {
    expect(
      msgs({
        webcredentials: { apps: ['ABCDE.com.example'] },
        appclips: { apps: ['ABCDE.com.example.Clip'] },
      }),
    ).toEqual([]);
  });

  it('reports invalid JSON', () => {
    expect(validateAppleAppSiteAssociation('nope')[0].message).toContain(
      'not valid JSON',
    );
  });

  it('reports a non-object root', () => {
    expect(msgs([])).toContain('The top-level value must be a JSON object.');
  });

  it('reports a file with no known service', () => {
    expect(msgs({ other: true })).toContain(
      'The file declares none of applinks, webcredentials or appclips.',
    );
  });

  it('reports a detail with neither appID nor appIDs', () => {
    expect(msgs({ applinks: { details: [{ components: [] }] } })).toContain(
      "applinks.details[0] must have a string 'appID' or a string array 'appIDs'.",
    );
  });

  it('reports a non-array details', () => {
    expect(msgs({ applinks: { details: {} } })).toContain(
      "'applinks.details' must be an array.",
    );
  });

  it('reports a webcredentials without an apps array', () => {
    expect(msgs({ webcredentials: {} })).toContain(
      "'webcredentials.apps' must be an array of app identifiers.",
    );
  });
});
