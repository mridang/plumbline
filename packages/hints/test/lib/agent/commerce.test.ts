import { describe, expect, it } from '@jest/globals';
import {
  checkAcp,
  checkMpp,
  checkUcp,
  checkX402,
  detectCommerceSignals,
} from '../../../src/lib/agent/commerce.js';
import { fakeEnv } from './fake-env.js';

describe('checkX402', () => {
  it('passes when a probed path answers 402', async () => {
    expect((await checkX402(fakeEnv({ '/api': { status: 402 } }))).passed).toBe(
      true,
    );
  });
  it('fails otherwise', async () => {
    expect((await checkX402(fakeEnv({ '/': { status: 200 } }))).passed).toBe(
      false,
    );
  });
});

describe('checkMpp', () => {
  it('passes with x-payment-info', async () => {
    const env = fakeEnv({
      '/openapi.json': '{"paths":{"/a":{"get":{"x-payment-info":{}}}}}',
    });
    expect((await checkMpp(env)).passed).toBe(true);
  });
  it('fails without it', async () => {
    expect((await checkMpp(fakeEnv({ '/openapi.json': '{}' }))).passed).toBe(
      false,
    );
    expect((await checkMpp(fakeEnv())).passed).toBe(false);
  });
});

describe('checkMpp challenge', () => {
  it('passes when a 402 challenges with WWW-Authenticate: Payment', async () => {
    const env = fakeEnv({
      '/': { status: 402, headers: { 'www-authenticate': 'Payment id="x"' } },
    });
    expect((await checkMpp(env)).passed).toBe(true);
  });
  it('fails for a 402 with another scheme', async () => {
    const env = fakeEnv({
      '/': { status: 402, headers: { 'www-authenticate': 'Bearer' } },
    });
    expect((await checkMpp(env)).passed).toBe(false);
  });
});

describe('checkUcp', () => {
  const ucp = { version: '2026-08-25', services: {}, payment_handlers: {} };
  it('passes with version, services and payment_handlers', async () => {
    expect(
      (await checkUcp(fakeEnv({ '/.well-known/ucp': { ucp } }))).passed,
    ).toBe(true);
  });
  it('names what is missing', async () => {
    const env = fakeEnv({ '/.well-known/ucp': { ucp: { version: 'latest' } } });
    expect((await checkUcp(env)).detail).toContain(
      'version, services, payment_handlers',
    );
  });
  it('fails without a profile', async () => {
    expect((await checkUcp(fakeEnv())).passed).toBe(false);
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
    expect(
      (await checkAcp(fakeEnv({ '/.well-known/acp.json': acp }))).passed,
    ).toBe(true);
  });
  it.each([
    ['protocol', { ...acp, protocol: { name: 'other', version: '1' } }],
    ['api_base_url', { ...acp, api_base_url: undefined }],
    ['transports', { ...acp, transports: ['mcp'] }],
    ['capabilities', { ...acp, capabilities: [] }],
  ])('fails without a valid %s', async (field, doc) => {
    const r = await checkAcp(fakeEnv({ '/.well-known/acp.json': doc }));
    expect(r.passed).toBe(false);
    expect(r.detail).toContain(field);
  });
  it('fails without the document', async () => {
    expect((await checkAcp(fakeEnv())).passed).toBe(false);
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
