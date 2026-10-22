import { describe, expect, it } from '@jest/globals';
import { evaluateCspStrength } from '../../../src/lib/secplus/csp-strength.js';

/** The messages of the findings, for substring assertions. */
function messages(policy: string): string[] {
  return evaluateCspStrength([policy]).map((f) => f.message);
}

describe('evaluateCspStrength', () => {
  it('returns nothing when no policy is given', () => {
    expect(evaluateCspStrength([])).toEqual([]);
    expect(evaluateCspStrength([''])).toEqual([]);
  });

  it('returns nothing for an unparsable policy (the csp hint handles it)', () => {
    // Shorter than the parser's minimum; parseCsp throws CspParseError.
    expect(evaluateCspStrength(['x'])).toEqual([]);
  });

  it('flags unsafe-inline without a nonce or hash in script-src', () => {
    const found = messages(
      "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'",
    );
    expect(found.some((m) => m.includes("'unsafe-inline'"))).toBe(true);
  });

  it('does not flag unsafe-inline when a nonce is present', () => {
    const found = messages(
      "script-src 'unsafe-inline' 'nonce-abc'; object-src 'none'; base-uri 'none'",
    );
    expect(found.some((m) => m.includes("'unsafe-inline'"))).toBe(false);
  });

  it('flags unsafe-eval', () => {
    const found = messages(
      "script-src 'self' 'unsafe-eval'; object-src 'none'; base-uri 'none'",
    );
    expect(found.some((m) => m.includes("'unsafe-eval'"))).toBe(true);
  });

  it('flags a missing script-src and default-src', () => {
    const found = messages("object-src 'none'; base-uri 'none'");
    expect(found.some((m) => m.includes('any origin'))).toBe(true);
  });

  it('flags a broad script-src source', () => {
    const found = messages(
      "script-src https:; object-src 'none'; base-uri 'none'",
    );
    expect(found.some((m) => m.includes('broad source'))).toBe(true);
  });

  it('flags a missing object-src', () => {
    const found = messages("script-src 'self'; base-uri 'none'");
    expect(found.some((m) => m.includes('object-src'))).toBe(true);
  });

  it('accepts object-src none via default-src none', () => {
    const found = messages("default-src 'none'; base-uri 'none'");
    expect(found.some((m) => m.includes('object-src'))).toBe(false);
  });

  it('flags a missing base-uri', () => {
    const found = messages("script-src 'self'; object-src 'none'");
    expect(found.some((m) => m.includes('base-uri'))).toBe(true);
  });

  it('advises strict-dynamic when a host allowlist is used', () => {
    const found = evaluateCspStrength([
      "script-src 'self' https://cdn.test; object-src 'none'; base-uri 'none'",
    ]);
    const advice = found.find((f) => f.message.includes("'strict-dynamic'"));
    expect(advice?.severity).toBe('hint');
  });

  it('does not advise strict-dynamic when it is already used', () => {
    const found = messages(
      "script-src 'nonce-abc' 'strict-dynamic' https://cdn.test; object-src 'none'; base-uri 'none'",
    );
    expect(found.some((m) => m.includes("'strict-dynamic'"))).toBe(false);
  });

  it('returns no findings for a strict nonce-based policy', () => {
    expect(
      evaluateCspStrength([
        "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'",
      ]),
    ).toEqual([]);
  });
});
