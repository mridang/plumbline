import { describe, expect, it } from '@jest/globals';
import { validateGpcJson } from '../../../src/lib/wellknown/gpc-json.js';

const msgs = (v: unknown) =>
  validateGpcJson(JSON.stringify(v)).map((i) => i.message);

describe('validateGpcJson', () => {
  it('accepts a valid date-only document', () => {
    expect(
      validateGpcJson(JSON.stringify({ gpc: true, lastUpdate: '2026-01-01' })),
    ).toEqual([]);
  });

  it('accepts a full date-time', () => {
    expect(msgs({ gpc: false, lastUpdate: '2026-01-01T00:00:00Z' })).toEqual(
      [],
    );
  });

  it('reports invalid JSON', () => {
    expect(validateGpcJson('nope')[0].message).toContain('not valid JSON');
  });

  it('reports a non-object root', () => {
    expect(msgs([])).toContain('The top-level value must be a JSON object.');
  });

  it('requires gpc to be boolean', () => {
    expect(msgs({ gpc: 'yes', lastUpdate: '2026-01-01' })).toContain(
      "The required 'gpc' field must be a boolean.",
    );
  });

  it('requires lastUpdate to be a string', () => {
    expect(msgs({ gpc: true })).toContain(
      "The required 'lastUpdate' field must be a string.",
    );
  });

  it('rejects a malformed lastUpdate', () => {
    expect(msgs({ gpc: true, lastUpdate: 'January 2026' })).toContain(
      "The 'lastUpdate' field must be an ISO 8601 date.",
    );
  });
});
