import { describe, expect, it } from '@jest/globals';
import { parseDkim } from '../../../src/lib/email/dkim.js';
import { generateKeyPairAsync } from '../../helpers/crypto.js';

const rsa = async (bits: number): Promise<string> => {
  const { publicKey } = await generateKeyPairAsync('rsa', {
    modulusLength: bits,
  });
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
};

const RSA_2048 = await rsa(2048);

describe('parseDkim', () => {
  it('accepts an RSA key record', () => {
    const result = parseDkim(`v=DKIM1; k=rsa; p=${RSA_2048}`);
    expect(result).toMatchObject({ valid: true, keyType: 'rsa', errors: [] });
  });

  it('defaults to RSA and does not need a version', () => {
    expect(parseDkim(`p=${RSA_2048}`)).toMatchObject({
      valid: true,
      keyType: 'rsa',
    });
  });

  it('accepts folded base64 and a trailing semicolon', () => {
    const folded = `${RSA_2048.slice(0, 40)} \t${RSA_2048.slice(40)}`;
    expect(parseDkim(`v=DKIM1; p=${folded};`).valid).toBe(true);
  });

  it('accepts an ed25519 key', () => {
    const key = Buffer.alloc(32, 1).toString('base64');
    expect(parseDkim(`v=DKIM1; k=ed25519; p=${key}`)).toMatchObject({
      valid: true,
      keyType: 'ed25519',
    });
  });

  it('rejects an ed25519 key of the wrong size', () => {
    const key = Buffer.alloc(31, 1).toString('base64');
    expect(parseDkim(`k=ed25519; p=${key}`).valid).toBe(false);
  });

  it('treats an empty key as revoked', () => {
    const result = parseDkim('v=DKIM1; p=');
    expect(result.revoked).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('rejects a missing p tag', () => {
    expect(parseDkim('v=DKIM1; k=rsa').errors).toContain(
      "The required 'p' tag is missing.",
    );
  });

  it('rejects a short RSA key', async () => {
    const result = parseDkim(`p=${await rsa(512)}`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('512 bits');
  });

  it('rejects bad base64 and keys that are not keys', () => {
    expect(parseDkim('p=not*base64').valid).toBe(false);
    expect(
      parseDkim(`p=${Buffer.from('hello world!').toString('base64')}`).valid,
    ).toBe(false);
  });

  it('rejects a wrong version and a misplaced version', () => {
    expect(parseDkim(`v=DKIM2; p=${RSA_2048}`).valid).toBe(false);
    expect(parseDkim(`p=${RSA_2048}; v=DKIM1`).errors).toContain(
      "The 'v' tag must come first.",
    );
  });

  it('rejects an unsupported key type', () => {
    const result = parseDkim(`k=dsa; p=${RSA_2048}`);
    expect(result.valid).toBe(false);
    expect(result.keyType).toBeNull();
  });

  it('rejects repeated tags and malformed pairs', () => {
    expect(parseDkim(`p=${RSA_2048}; p=${RSA_2048}`).valid).toBe(false);
    expect(parseDkim(`p=${RSA_2048}; nonsense`).valid).toBe(false);
  });

  it('ignores unknown tags', () => {
    expect(parseDkim(`p=${RSA_2048}; x=whatever`).valid).toBe(true);
  });

  it('validates h, s and t', () => {
    expect(parseDkim(`h=sha256:sha1; s=email; p=${RSA_2048}`).valid).toBe(true);
    expect(parseDkim(`s=*; p=${RSA_2048}`).valid).toBe(true);
    expect(parseDkim(`h=sha 256; p=${RSA_2048}`).valid).toBe(false);
    expect(parseDkim(`s=a b; p=${RSA_2048}`).valid).toBe(false);
    expect(parseDkim(`t=@; p=${RSA_2048}`).valid).toBe(false);
  });

  it('detects testing mode', () => {
    expect(parseDkim(`t=y:s; p=${RSA_2048}`).testing).toBe(true);
    expect(parseDkim(`t=s; p=${RSA_2048}`).testing).toBe(false);
  });
});
