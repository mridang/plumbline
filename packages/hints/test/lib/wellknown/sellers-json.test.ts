import { describe, expect, it } from '@jest/globals';
import { validateSellersJson } from '../../../src/lib/wellknown/sellers-json.js';

const msgs = (v: unknown) =>
  validateSellersJson(JSON.stringify(v)).map((i) => i.message);

const valid = {
  version: '1.0',
  contact_email: 'ads@example.com',
  sellers: [
    { seller_id: '1', seller_type: 'PUBLISHER', name: 'A', domain: 'a.com' },
  ],
};

describe('validateSellersJson', () => {
  it('accepts a valid document', () => {
    expect(validateSellersJson(JSON.stringify(valid))).toEqual([]);
  });

  it('accepts a confidential seller without name or domain', () => {
    expect(
      msgs({
        version: '1.0',
        sellers: [
          { seller_id: '2', seller_type: 'INTERMEDIARY', is_confidential: 1 },
        ],
      }),
    ).toEqual([]);
  });

  it('reports invalid JSON', () => {
    expect(validateSellersJson('{ not json')[0].message).toContain(
      'not valid JSON',
    );
  });

  it('reports a non-object root', () => {
    expect(msgs([1, 2])).toContain(
      'The top-level value must be a JSON object.',
    );
  });

  it('requires version', () => {
    expect(msgs({ sellers: [] })).toContain(
      "The required 'version' field is missing or not a string.",
    );
  });

  it('requires sellers to be an array', () => {
    expect(msgs({ version: '1.0', sellers: {} })).toContain(
      "The required 'sellers' field must be an array.",
    );
  });

  it('reports a bad contact_email type', () => {
    expect(msgs({ version: '1.0', contact_email: 5, sellers: [] })).toContain(
      "The 'contact_email' field must be a string.",
    );
  });

  it('reports a malformed identifiers entry', () => {
    expect(
      msgs({ version: '1.0', sellers: [], identifiers: [{ name: 'x' }] }),
    ).toContain("identifiers[0] must have string 'name' and 'value' fields.");
  });

  it('requires a seller_id', () => {
    expect(
      msgs({ version: '1.0', sellers: [{ seller_type: 'PUBLISHER' }] }),
    ).toContain("sellers[0] is missing a string 'seller_id'.");
  });

  it('reports a duplicate seller_id', () => {
    expect(
      msgs({
        version: '1.0',
        sellers: [
          { seller_id: '1', seller_type: 'PUBLISHER', is_confidential: 1 },
          { seller_id: '1', seller_type: 'PUBLISHER', is_confidential: 1 },
        ],
      }),
    ).toContain("sellers[1] repeats the seller_id '1', which must be unique.");
  });

  it('reports an invalid seller_type', () => {
    expect(
      msgs({
        version: '1.0',
        sellers: [{ seller_id: '1', seller_type: 'OTHER', is_confidential: 1 }],
      }),
    ).toContain(
      'sellers[0] has an invalid seller_type; expected PUBLISHER, INTERMEDIARY or BOTH.',
    );
  });

  it('requires name and domain for a non-confidential seller', () => {
    const m = msgs({
      version: '1.0',
      sellers: [{ seller_id: '1', seller_type: 'PUBLISHER' }],
    });
    expect(m).toContain(
      "sellers[0] must have a 'name' unless it is confidential.",
    );
    expect(m).toContain(
      "sellers[0] must have a 'domain' unless it is confidential.",
    );
  });
});
