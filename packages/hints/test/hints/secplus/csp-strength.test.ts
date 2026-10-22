import { describe, expect, it } from '@jest/globals';
import { runHint } from '../../helpers/run-hint.js';
import cspStrength from '../../../src/hints/secplus/csp-strength.js';

/** Serves the page with the given Content-Security-Policy header. */
function withCsp(policy: string) {
  return {
    '/': {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': policy,
      },
    },
  };
}

describe('the csp-strength hint', () => {
  it('flags unsafe-inline without a nonce in script-src', async () => {
    const problems = await runHint(
      cspStrength,
      withCsp(
        "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'",
      ),
    );
    expect(problems.some((p) => p.message.includes("'unsafe-inline'"))).toBe(
      true,
    );
  });

  it('flags a missing object-src and base-uri', async () => {
    const problems = await runHint(cspStrength, withCsp("script-src 'self'"));
    expect(problems.some((p) => p.message.includes('object-src'))).toBe(true);
    expect(problems.some((p) => p.message.includes('base-uri'))).toBe(true);
  });

  it('passes a strict nonce-based policy', async () => {
    const problems = await runHint(
      cspStrength,
      withCsp(
        "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'",
      ),
    );
    expect(problems).toHaveLength(0);
  });

  it('does nothing when no CSP is present (the csp hint handles absence)', async () => {
    const problems = await runHint(cspStrength);
    expect(problems).toHaveLength(0);
  });

  it('reads a policy from a <meta http-equiv> when no header is set', async () => {
    const problems = await runHint(cspStrength, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><title>t</title></head><body></body></html>',
      },
    });
    expect(problems.some((p) => p.message.includes('object-src'))).toBe(true);
  });
});
