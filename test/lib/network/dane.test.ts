import { afterEach, describe, expect, it } from '@jest/globals';
import { X509Certificate, createHash } from 'node:crypto';
import {
  daneExistence,
  daneValidity,
  parseTlsa,
  tls,
  tlsaMatches,
  type PresentedChain,
} from '../../../src/lib/network/dane.js';
import { installDns } from './fake-dns.js';

/** Throw-away self-signed P-256 certificates, valid for 100 years. */
const LEAF_PEM = `-----BEGIN CERTIFICATE-----
MIIBfjCCASWgAwIBAgIUEPSlIoXia+/LqWo50D27dWGkbg4wCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbGVhZi50ZXN0MCAXDTI2MTAyMTA5MjU1MVoYDzIxMjYwOTI3
MDkyNTUxWjAUMRIwEAYDVQQDDAlsZWFmLnRlc3QwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAASr/FuNuYWkCwqCiNMQ3NCj/c5PlruMPuFsqXK61o6bSN5+XBHmQLdB
E4TwdjdWCDJmBCEqPikr3Fg3vGVmuBcFo1MwUTAdBgNVHQ4EFgQU/FMLNdUK9F6M
4NBZY+5lnIIt2PQwHwYDVR0jBBgwFoAU/FMLNdUK9F6M4NBZY+5lnIIt2PQwDwYD
VR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNHADBEAiBEGzJsTkWPI576FKE/+ejZ
9pNJ/DLfnP2iP64loupAFgIgJqdavKtM511yQLkftJdWL2+wO8zV0qxKFhbjh7ML
E/w=
-----END CERTIFICATE-----`;
const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIBejCCASGgAwIBAgIUAwKd6UuGjsui3cK6wyvepwl7i2owCgYIKoZIzj0EAwIw
EjEQMA4GA1UEAwwHY2EudGVzdDAgFw0yNjEwMjEwOTI1NTJaGA8yMTI2MDkyNzA5
MjU1MlowEjEQMA4GA1UEAwwHY2EudGVzdDBZMBMGByqGSM49AgEGCCqGSM49AwEH
A0IABDWDHORxz3MrSu4+0Tu83Yjw/hTgisQRGetoiIvvp14SM8l2ohGBnamAZKVd
S0UDoikHcoBeBRYTP7Baoyfk6gGjUzBRMB0GA1UdDgQWBBQdnV8x8sWubojaiMvs
sDJvkgflJjAfBgNVHSMEGDAWgBQdnV8x8sWubojaiMvssDJvkgflJjAPBgNVHRMB
Af8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIHOfQ23LX3KoH54rgpH2B3ylCRmy
zqknU2cGHAPxNYDrAiAHM3+5XUFVF+rgFyMAq77TKECBum2EzfRHWi9mW1ZcMw==
-----END CERTIFICATE-----`;

const leaf = new X509Certificate(LEAF_PEM);
const ca = new X509Certificate(CA_PEM);
const chain = (pkixValid: boolean): PresentedChain => ({
  chain: [leaf.raw, ca.raw],
  pkixValid,
});
const spki = (c: X509Certificate) =>
  c.publicKey.export({ type: 'spki', format: 'der' });
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const sha512 = (b: Buffer) => createHash('sha512').update(b).digest('hex');

const realFetch = tls.fetchChain;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  tls.fetchChain = realFetch;
});

describe('parseTlsa', () => {
  it('parses presentation format', () => {
    expect(parseTlsa('3 1 1 ABCD ef01')).toEqual({
      usage: 3,
      selector: 1,
      matching: 1,
      data: 'abcdef01',
    });
  });
  it('parses the generic format', () => {
    expect(parseTlsa('\\# 7 030101abcd')).toEqual({
      usage: 3,
      selector: 1,
      matching: 1,
      data: 'abcd',
    });
  });
  it('rejects garbage', () => {
    expect(parseTlsa('nonsense')).toBeNull();
    expect(parseTlsa('\\# 2 0301')).toBeNull();
  });
});

describe('daneExistence', () => {
  const name = '_443._tcp.example.test';
  it('exists when authenticated TLSA records are published', async () => {
    restore = installDns({
      [name]: { TLSA: { data: ['3 1 1 abcd'], ad: true } },
    });
    const r = await daneExistence('example.test');
    expect(r.state).toBe('exists');
  });
  it('does not exist without TLSA records', async () => {
    restore = installDns({});
    expect((await daneExistence('example.test')).state).toBe('none');
  });
  it('does not count TLSA records that are not DNSSEC secured', async () => {
    restore = installDns({ [name]: { TLSA: { data: ['3 1 1 abcd'] } } });
    expect((await daneExistence('example.test')).state).toBe('none');
  });
  it('is bogus on SERVFAIL', async () => {
    restore = installDns({ [name]: { TLSA: { status: 2 } } });
    expect((await daneExistence('example.test')).state).toBe('bogus');
  });
});

describe('tlsaMatches', () => {
  const rec = (
    usage: number,
    selector: number,
    matching: number,
    data: string,
  ) => ({
    usage,
    selector,
    matching,
    data,
  });

  it('matches DANE-EE on the leaf SPKI by SHA-256', () => {
    expect(tlsaMatches([rec(3, 1, 1, sha256(spki(leaf)))], chain(false))).toBe(
      true,
    );
  });
  it('matches DANE-EE on the full certificate, exact and SHA-512', () => {
    expect(
      tlsaMatches([rec(3, 0, 0, leaf.raw.toString('hex'))], chain(false)),
    ).toBe(true);
    expect(tlsaMatches([rec(3, 0, 2, sha512(leaf.raw))], chain(false))).toBe(
      true,
    );
  });
  it('does not match a different certificate', () => {
    expect(tlsaMatches([rec(3, 1, 1, sha256(spki(ca)))], chain(false))).toBe(
      false,
    );
  });
  it('matches DANE-TA on an issuer but not on the leaf', () => {
    expect(tlsaMatches([rec(2, 1, 1, sha256(spki(ca)))], chain(false))).toBe(
      true,
    );
    expect(tlsaMatches([rec(2, 1, 1, sha256(spki(leaf)))], chain(false))).toBe(
      false,
    );
  });
  it('needs a PKIX valid chain for the PKIX usages', () => {
    const records = [rec(1, 1, 1, sha256(spki(leaf)))];
    expect(tlsaMatches(records, chain(false))).toBe(false);
    expect(tlsaMatches(records, chain(true))).toBe(true);
    const ta = [rec(0, 1, 1, sha256(spki(ca)))];
    expect(tlsaMatches(ta, chain(false))).toBe(false);
    expect(tlsaMatches(ta, chain(true))).toBe(true);
  });
  it('ignores records with undefined parameters', () => {
    expect(tlsaMatches([rec(9, 1, 1, sha256(spki(leaf)))], chain(true))).toBe(
      false,
    );
    expect(tlsaMatches([rec(3, 5, 1, 'aa')], chain(true))).toBe(false);
    expect(tlsaMatches([rec(3, 1, 7, 'aa')], chain(true))).toBe(false);
  });
});

describe('daneValidity', () => {
  it('is valid, invalid or untested depending on the presented chain', async () => {
    const good = [
      { usage: 3, selector: 1, matching: 1, data: sha256(spki(leaf)) },
    ];
    tls.fetchChain = async () => chain(false);
    expect(await daneValidity('example.test', good)).toBe('valid');
    expect(
      await daneValidity('example.test', [{ ...good[0], data: '00' }]),
    ).toBe('invalid');
    tls.fetchChain = async () => null;
    expect(await daneValidity('example.test', good)).toBe('untested');
  });
});
