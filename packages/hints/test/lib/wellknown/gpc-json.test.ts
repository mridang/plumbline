import { describe, expect, it } from '@jest/globals';
import {
  ISO_DATE,
  validateGpcJson,
} from '../../../src/lib/wellknown/gpc-json.js';

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

/** A small seeded generator, so a failure replays exactly. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

function generate(
  random: () => number,
  pieces: string[],
  count: number,
): string {
  let text = '';
  for (let i = 0; i < count; i += 1) {
    text += pieces[Math.floor(random() * pieces.length)];
  }
  return text;
}

describe('ISO_DATE', () => {
  const old = new RegExp(
    [
      String.raw`^\d{4}-\d{2}-\d{2}`,
      String.raw`([Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$`,
    ].join(''),
  );

  it.each([
    '2026-01-01',
    '2026-01-01T10:20:30Z',
    '2026-01-01t10:20:30.123+05:30',
    '2026-01-01T10:20:30',
    '2026-1-01',
    '2026-01-01T10:20',
    '',
  ])('treats %j like the old pattern', (text) => {
    expect(ISO_DATE.test(text)).toBe(old.test(text));
  });

  it('matches the old pattern on seeded random text', () => {
    const random = seeded(3);
    const pieces = ['2', '0', '-', 'T', 't', ':', '.', 'Z', '+', '1', ' '];
    for (let i = 0; i < 20_000; i += 1) {
      const text = generate(random, pieces, 20);
      expect(ISO_DATE.test(text)).toBe(old.test(text));
    }
  });

  it('agrees on a long adversarial input', () => {
    const text = `2026-01-01T10:20:30.${'1'.repeat(100_000)}x`;
    expect(ISO_DATE.test(text)).toBe(old.test(text));
  });
});
