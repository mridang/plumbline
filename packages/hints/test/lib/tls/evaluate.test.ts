import { describe, expect, it } from '@jest/globals';
import {
  evaluateCipherOrder,
  evaluateCiphers,
  evaluateKex,
  evaluateProtocols,
  formatVersion,
  rateCertificateKey,
  rateCipher,
  rateClientRenegotiation,
  rateEphemeralKey,
  rateOcsp,
  rateProtocol,
  rateSignatureAlgorithm,
  type CipherInfo,
} from '../../../src/lib/tls/evaluate.js';
import { vector } from '../../helpers/data.js';

const GOOD = 'TLS_AES_256_GCM_SHA384';
const SUFFICIENT = 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256';
const PHASE_OUT = 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256';
const BAD = 'TLS_RSA_WITH_AES_128_CBC_SHA';

const cipher = (standardName: string): CipherInfo => ({
  name: standardName.toLowerCase(),
  standardName,
});

describe('protocols', () => {
  it.each([
    ['TLSv1.3', 'good'],
    ['TLSv1.2', 'sufficient'],
    ['TLSv1.1', 'bad'],
    ['TLSv1', 'bad'],
  ] as const)('rates %s as %s', (version, rating) => {
    expect(rateProtocol(version)).toBe(rating);
  });

  it('groups accepted versions', () => {
    expect(evaluateProtocols(['TLSv1.3', 'TLSv1.2', 'TLSv1'])).toEqual({
      good: ['TLSv1.3'],
      sufficient: ['TLSv1.2'],
      phaseOut: [],
      bad: ['TLSv1'],
    });
  });

  it('formats versions like Internet.nl', () => {
    expect(formatVersion('TLSv1')).toBe('TLS 1.0');
    expect(formatVersion('TLSv1.2')).toBe('TLS 1.2');
  });
});

describe('ciphers', () => {
  it.each([
    [GOOD, 'good'],
    [SUFFICIENT, 'sufficient'],
    [PHASE_OUT, 'phase-out'],
    [BAD, 'bad'],
    ['TLS_AES_128_GCM_SHA256', 'sufficient'],
    ['TLS_AES_128_CCM_8_SHA256', 'bad'],
    ['TLS_ECDHE_RSA_WITH_RC4_128_SHA', 'bad'],
  ] as const)('rates %s as %s', (name, rating) => {
    expect(rateCipher(name)).toBe(rating);
  });

  it('groups the suites and drops duplicates', () => {
    expect(evaluateCiphers([GOOD, SUFFICIENT, PHASE_OUT, BAD, BAD])).toEqual({
      good: [GOOD],
      sufficient: [SUFFICIENT],
      phaseOut: [PHASE_OUT],
      bad: [BAD],
    });
  });
});

describe('key exchange parameters', () => {
  it.each([
    [{ type: 'ECDH', size: 253, name: 'X25519' }, 'good'],
    [{ type: 'ECDH', size: 256, name: 'prime256v1' }, 'good'],
    [{ type: 'ECDH', size: 224, name: 'secp224r1' }, 'phase-out'],
    [{ type: 'ECDH', size: 256, name: 'secp256k1' }, 'bad'],
    [{ type: 'ECDH', size: 1 }, 'bad'],
    [{ type: 'DH', size: 4096 }, 'phase-out'],
    [{ type: 'DH', size: 3072 }, 'phase-out'],
    [{ type: 'DH', size: 2048 }, 'bad'],
    [{ type: 'DH', size: 1024 }, 'bad'],
  ] as const)('rates %j as %s', (key, rating) => {
    expect(rateEphemeralKey(key).rating).toBe(rating);
  });

  it('labels the parameters', () => {
    expect(rateEphemeralKey({ type: 'DH', size: 2048 }).label).toBe('DH-2048');
    expect(
      rateEphemeralKey({ type: 'ECDH', size: 256, name: 'secp256k1' }).label,
    ).toBe('ECDH-secp256k1');
  });

  it('evaluates a set of keys with the largest sizes', () => {
    expect(
      evaluateKex([
        { type: 'ECDH', size: 253, name: 'X25519' },
        { type: 'ECDH', size: 224, name: 'secp224r1' },
        { type: 'ECDH', size: 224, name: 'secp224r1' },
        { type: 'DH', size: 2048 },
        { type: 'DH', size: 1024 },
      ]),
    ).toEqual({
      phaseOut: ['ECDH-secp224r1'],
      bad: ['DH-2048', 'DH-1024'],
      maxDhSize: 2048,
      maxEcSize: 253,
    });
  });

  it('has no sizes without keys', () => {
    expect(evaluateKex([])).toEqual({
      phaseOut: [],
      bad: [],
      maxDhSize: null,
      maxEcSize: null,
    });
  });
});

describe('evaluateCipherOrder', () => {
  const accepted = [cipher(PHASE_OUT), cipher(SUFFICIENT), cipher(GOOD)];

  it('is good when the server picks the better suite', async () => {
    const offers: string[][] = [];
    const result = await evaluateCipherOrder(accepted, (offered) => {
      offers.push(offered.map((c) => c.standardName));
      return Promise.resolve(offered.at(-1));
    });
    expect(result).toEqual({ status: 'good', violation: null });
    expect(offers).toEqual([
      [PHASE_OUT, SUFFICIENT],
      [PHASE_OUT, GOOD],
    ]);
  });

  it('is bad when the server follows the client order', async () => {
    const result = await evaluateCipherOrder(accepted, (offered) =>
      Promise.resolve(offered[0]),
    );
    expect(result).toEqual({
      status: 'bad',
      violation: [PHASE_OUT, SUFFICIENT],
    });
  });

  it('puts CHACHA last among the phase out suites', async () => {
    const chacha = 'TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256';
    let offered: readonly CipherInfo[] = [];
    await evaluateCipherOrder(
      [cipher(chacha), cipher(PHASE_OUT), cipher(GOOD)],
      (list) => {
        offered = list;
        return Promise.resolve(list.at(-1));
      },
    );
    expect(offered.map((c) => c.standardName)).toEqual([
      PHASE_OUT,
      chacha,
      GOOD,
    ]);
  });

  it('does not apply when only good and sufficient suites are accepted', async () => {
    const result = await evaluateCipherOrder(
      [cipher(SUFFICIENT), cipher(GOOD)],
      () => Promise.reject(new Error('must not connect')),
    );
    expect(result.status).toBe('na');
  });

  it('does not apply to TLS 1.3 only servers', async () => {
    const result = await evaluateCipherOrder(
      accepted,
      () => Promise.reject(new Error('must not connect')),
      true,
    );
    expect(result.status).toBe('na');
  });

  it('has nothing to compare without a better suite', async () => {
    const result = await evaluateCipherOrder(
      [cipher(PHASE_OUT), cipher(BAD)],
      () => Promise.reject(new Error('must not connect')),
    );
    expect(result.status).toBe('good');
  });

  it('does not apply when the test connection fails', async () => {
    const result = await evaluateCipherOrder(accepted, () =>
      Promise.resolve(null),
    );
    expect(result.status).toBe('na');
  });
});

describe('certificate keys', () => {
  it.each([
    [{ type: 'rsa', modulusLength: 4096 }, 'good'],
    [{ type: 'rsa', modulusLength: 3072 }, 'good'],
    [{ type: 'rsa', modulusLength: 2048 }, 'phase-out'],
    [{ type: 'rsa', modulusLength: 1024 }, 'bad'],
    [{ type: 'ec', curve: 'prime256v1' }, 'good'],
    [{ type: 'ec', curve: 'brainpoolP384r1' }, 'good'],
    [{ type: 'ec', curve: 'secp224r1' }, 'phase-out'],
    [{ type: 'ec', curve: 'secp256k1' }, 'bad'],
    [{ type: 'ed25519' }, 'good'],
    [{ type: 'ed448' }, 'good'],
    [{ type: 'dsa' }, 'bad'],
  ])('rates %j as %s', (key, rating) => {
    expect(rateCertificateKey(key).rating).toBe(rating);
  });

  it('describes keys like Internet.nl', () => {
    expect(
      rateCertificateKey({ type: 'rsa', modulusLength: 2048 }).description,
    ).toBe('RSA-2048');
    expect(
      rateCertificateKey({ type: 'ec', curve: 'secp224r1' }).description,
    ).toBe('EC, curve: secp224r1');
  });
});

describe('signature algorithms', () => {
  it.each([
    ['1.2.840.113549.1.1.11', 'sufficient', 'sha256WithRSAEncryption'],
    ['1.2.840.10045.4.3.3', 'sufficient', 'ecdsa-with-SHA384'],
    [vector('ip1_3_101_112'), 'sufficient', 'ED25519'],
    ['1.2.840.113549.1.1.14', 'phase-out', 'sha224WithRSAEncryption'],
    ['1.2.840.10045.4.3.1', 'phase-out', 'ecdsa-with-SHA224'],
    ['1.2.840.113549.1.1.5', 'bad', 'sha1WithRSAEncryption'],
    ['1.2.840.113549.1.1.4', 'bad', 'md5WithRSAEncryption'],
    ['1.2.840.113549.1.1.10', 'bad', 'rsassaPss'],
    [vector('ip1_2_3_4'), 'bad', vector('ip1_2_3_4')],
  ] as const)('rates %s as %s', (oid, rating, name) => {
    expect(rateSignatureAlgorithm(oid)).toEqual({ rating, name });
  });
});

describe('client renegotiation', () => {
  it.each([
    [0, 'not-allowed'],
    [1, 'allowed-with-low-limit'],
    [10, 'allowed-with-low-limit'],
    [11, 'allowed-with-too-high-limit'],
  ] as const)('rates %i successes as %s', (count, status) => {
    expect(rateClientRenegotiation(count)).toBe(status);
  });
});

describe('rateOcsp', () => {
  it.each([
    [false, false, 'not-in-cert'],
    [false, true, 'not-in-cert'],
    [true, true, 'good'],
    [true, false, 'ok'],
  ] as const)('pointer %s, staple %s is %s', (pointer, staple, status) => {
    expect(rateOcsp(pointer, staple)).toBe(status);
  });
});
