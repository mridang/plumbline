import { describe, expect, it } from '@jest/globals';
import {
  checkAcp,
  checkMpp,
  checkUcp,
  checkX402,
  detectCommerceSignals,
} from '../../../src/lib/agent/commerce.js';
import { fakeEnv, without } from './fake-env.js';

describe('checkX402', () => {
  it('passes when a probed path answers 402', async () => {
    const result = await checkX402(fakeEnv({ '/api': { status: 402 } }));
    expect(result.passed).toBe(true);
  });
  it('fails otherwise', async () => {
    const result = await checkX402(fakeEnv({ '/': { status: 200 } }));
    expect(result.passed).toBe(false);
  });
});

describe('checkMpp', () => {
  it('passes with x-payment-info', async () => {
    const env = fakeEnv({
      '/openapi.json': '{"paths":{"/a":{"get":{"x-payment-info":{}}}}}',
    });
    const result = await checkMpp(env);
    expect(result.passed).toBe(true);
  });
  it('fails without it', async () => {
    const withoutInfo = await checkMpp(fakeEnv({ '/openapi.json': '{}' }));
    expect(withoutInfo.passed).toBe(false);
    const missing = await checkMpp(fakeEnv());
    expect(missing.passed).toBe(false);
  });
});

describe('checkMpp challenge', () => {
  it('passes when a 402 challenges with WWW-Authenticate: Payment', async () => {
    const env = fakeEnv({
      '/': { status: 402, headers: { 'www-authenticate': 'Payment id="x"' } },
    });
    const result = await checkMpp(env);
    expect(result.passed).toBe(true);
  });
  it('fails for a 402 with another scheme', async () => {
    const env = fakeEnv({
      '/': { status: 402, headers: { 'www-authenticate': 'Bearer' } },
    });
    const result = await checkMpp(env);
    expect(result.passed).toBe(false);
  });
});

describe('checkUcp', () => {
  const ucp = { version: '2026-08-25', services: {}, payment_handlers: {} };
  it('passes with version, services and payment_handlers', async () => {
    const result = await checkUcp(fakeEnv({ '/.well-known/ucp': { ucp } }));
    expect(result.passed).toBe(true);
  });
  it('names what is missing', async () => {
    const env = fakeEnv({ '/.well-known/ucp': { ucp: { version: 'latest' } } });
    const result = await checkUcp(env);
    expect(result.detail).toContain('version, services, payment_handlers');
  });
  it('fails without a profile', async () => {
    const result = await checkUcp(fakeEnv());
    expect(result.passed).toBe(false);
  });
});

describe('checkAcp', () => {
  const acp = {
    protocol: { name: 'acp', version: '2025-09-29' },
    api_base_url: 'https://example.com/acp',
    transports: ['rest'],
    capabilities: { services: ['checkout'] },
  };
  it('passes with a complete document', async () => {
    const result = await checkAcp(fakeEnv({ '/.well-known/acp.json': acp }));
    expect(result.passed).toBe(true);
  });
  it.each([
    ['protocol', { ...acp, protocol: { name: 'other', version: '1' } }],
    ['api_base_url', without(acp, 'api_base_url')],
    ['transports', { ...acp, transports: ['mcp'] }],
    ['capabilities', { ...acp, capabilities: [] }],
  ])('fails without a valid %s', async (field, doc) => {
    const r = await checkAcp(fakeEnv({ '/.well-known/acp.json': doc }));
    expect(r.passed).toBe(false);
    expect(r.detail).toContain(field);
  });
  it('fails without the document', async () => {
    const result = await checkAcp(fakeEnv());
    expect(result.passed).toBe(false);
  });
});

describe('detectCommerceSignals', () => {
  it('detects a passed commerce check', async () => {
    const results = [
      {
        id: 'agent-x402',
        category: 'commerce' as const,
        passed: true,
        detail: '',
      },
    ];
    expect(await detectCommerceSignals(fakeEnv(), results)).toBe(true);
  });
  it('detects storefront markers on the home page', async () => {
    expect(
      await detectCommerceSignals(
        fakeEnv({ '/': '<button>Add to cart</button>' }),
        [],
      ),
    ).toBe(true);
  });
  it('detects a Product in structured data', async () => {
    expect(
      await detectCommerceSignals(
        fakeEnv({ '/': '<script>{"@type": "Product"}</script>' }),
        [],
      ),
    ).toBe(true);
  });
  it('does not treat a free Offer as a shop, as on a free app', async () => {
    expect(
      await detectCommerceSignals(
        fakeEnv({
          '/': '<script>{"offers":{"@type":"Offer","price":"0"}}</script>',
        }),
        [],
      ),
    ).toBe(false);
  });
  it('is false for a plain site', async () => {
    expect(
      await detectCommerceSignals(fakeEnv({ '/': '<p>hello</p>' }), []),
    ).toBe(false);
  });
});
