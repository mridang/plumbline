import { describe, expect, it } from '@jest/globals';

import {
  ProbeError,
  encodeBatch,
  encodeItem,
  fromBase64,
  parseBatch,
  parseBody,
  parseHandshake,
  parseHttp,
  parseOpenssl,
  parseReachable,
  parseStarttls,
  toBase64,
} from '../../../src/engine/probe/protocol.js';
import { handshakeAnswer, httpAnswer } from '../../helpers/probe.js';

describe('encodeItem', () => {
  it('writes key=value lines, repeats a list, and leaves out undefined and false', () => {
    expect(
      encodeItem({
        host: 'example.com',
        port: 443,
        tls: true,
        nobody: false,
        ip: undefined,
        header: ['A: 1', 'B: 2'],
      }),
    ).toBe('host=example.com\nport=443\ntls=1\nheader=A: 1\nheader=B: 2\n');
  });

  it('refuses a value that holds a line break, so nothing can add a key', () => {
    expect(() => encodeItem({ host: 'a\nport=25' })).toThrow(ProbeError);
    expect(() => encodeItem({ header: ['ok', 'bad\r'] })).toThrow(
      'header holds a line break',
    );
  });

  it('joins a batch the way the probe splits it', () => {
    expect(encodeBatch(['a=1\n', 'b=2\n'])).toBe('a=1\n--\nb=2\n');
  });
});

describe('base64', () => {
  it('goes both ways', () => {
    expect(new TextDecoder().decode(fromBase64('aGk='))).toBe('hi');
    expect(toBase64('hi')).toBe('aGk=');
  });
});

describe('parseBody', () => {
  it("names the probe's own complaint", () => {
    expect(() => parseBody('{"error":"not a public address"}')).toThrow(
      'not a public address',
    );
  });

  it('refuses something that is not JSON, or not an object', () => {
    expect(() => parseBody('<html>')).toThrow('not JSON');
    expect(() => parseBody('[1]')).toThrow('not an object');
    expect(() => parseBody('"text"')).toThrow('not an object');
  });
});

describe('parseHandshake', () => {
  it('reads a whole answer, the certificate facts and the OCSP pointer included', () => {
    const answer = parseHandshake(handshakeAnswer());
    expect(answer.protocol).toBe('TLSv1.3');
    expect(answer.cipher.name).toBe('TLS_AES_256_GCM_SHA384');
    expect(answer.ephemeral).toEqual({
      type: 'ECDH',
      size: 253,
      name: 'X25519',
    });
    expect(answer.certificates[0]?.infoAccess).toEqual({
      // eslint-disable-next-line unicorn/prefer-https -- test fixture
      'OCSP - URI': ['http://ocsp.example.com'],
    });
    expect(answer.compression).toBe(false);
  });

  it('reads a DH key exchange and a missing one', () => {
    expect(
      parseHandshake({
        ...handshakeAnswer(),
        ephemeral: { type: 'DH', size: 2048 },
      }).ephemeral,
    ).toEqual({
      type: 'DH',
      size: 2048,
    });
    expect(
      parseHandshake({ ...handshakeAnswer(), ephemeral: null }).ephemeral,
    ).toBeNull();
  });

  it.each([
    [
      'an error',
      { error: 'handshake failed: tlsv1 alert protocol version' },
      'handshake failed',
    ],
    [
      'no cipher',
      { ...handshakeAnswer(), cipher: 'x' },
      'cipher is not an object',
    ],
    [
      'no certificates',
      { ...handshakeAnswer(), certificates: 'x' },
      'certificates are not a list',
    ],
    [
      'a protocol that is a number',
      { ...handshakeAnswer(), protocol: 3 },
      'protocol is not text',
    ],
    [
      'authorized as text',
      { ...handshakeAnswer(), authorized: 'yes' },
      'authorized is not true or false',
    ],
    [
      'a chain that is not a list',
      { ...handshakeAnswer(), chain: 'x' },
      'chain is not a list',
    ],
    [
      'a certificate that is not an object',
      { ...handshakeAnswer(), certificates: [1] },
      'certificate is not an object',
    ],
    [
      'a key exchange that is not an object',
      { ...handshakeAnswer(), ephemeral: 'x' },
      'key exchange is not an object',
    ],
    [
      'a key exchange size that is not a number',
      { ...handshakeAnswer(), ephemeral: { type: 'DH', size: 'x' } },
      'size is not a number',
    ],
    ['something that is not an object', 'x', 'not an object'],
  ])('refuses %s', (_name, value, message) => {
    expect(() => parseHandshake(value)).toThrow(message);
  });
});

describe('parseBatch', () => {
  it('gives each entry its answer or its complaint, in order', () => {
    const [first, second, third] = parseBatch(
      JSON.stringify({
        results: [handshakeAnswer(), { error: 'not a public address' }, 5],
      }),
    );
    expect(first).toMatchObject({ protocol: 'TLSv1.3' });
    expect(second).toBeInstanceOf(ProbeError);
    expect((second as ProbeError).message).toBe('not a public address');
    expect(third).toBeInstanceOf(ProbeError);
  });

  it('refuses results that are not a list', () => {
    expect(() => parseBatch('{"results":1}')).toThrow('results are not a list');
  });
});

describe('parseHttp', () => {
  it('keeps every header line, in order, with duplicates, and decodes the body bytes', () => {
    const answer = parseHttp(
      httpAnswer(
        200,
        [
          ['Set-Cookie', 'a=1'],
          ['Set-Cookie', 'b=2'],
          ['Alt-Svc', 'h3=":443"'],
        ],
        'hello',
      ),
    );
    expect(answer.status).toBe(200);
    expect(answer.headers).toEqual([
      ['Set-Cookie', 'a=1'],
      ['Set-Cookie', 'b=2'],
      ['Alt-Svc', 'h3=":443"'],
    ]);
    expect(new TextDecoder().decode(answer.body)).toBe('hello');
    expect(answer.truncated).toBe(false);
  });

  it.each([
    [
      'headers that are not a list',
      {
        httpVersion: 'HTTP/1.1',
        status: 200,
        statusText: 'OK',
        headers: 1,
        body: '',
      },
      'headers are not a list',
    ],
    [
      'a header that is not a pair',
      {
        httpVersion: 'HTTP/1.1',
        status: 200,
        statusText: 'OK',
        headers: [['a']],
        body: '',
      },
      'not a pair',
    ],
    [
      'a status that is text',
      {
        httpVersion: 'HTTP/1.1',
        status: 'ok',
        statusText: 'OK',
        headers: [],
        body: '',
      },
      'status is not a number',
    ],
    [
      'no body',
      { httpVersion: 'HTTP/1.1', status: 200, statusText: 'OK', headers: [] },
      'body is not text',
    ],
  ])('refuses %s', (_name, value, message) => {
    expect(() => parseHttp(JSON.stringify(value))).toThrow(message);
  });
});

describe('parseStarttls', () => {
  const base = {
    reachable: true,
    starttls: true,
    tlsVersion: 'TLSv1.3',
    trusted: true,
    trustError: null,
    hostnameMatches: true,
    certificates: ['AAEC'],
    error: null,
  };

  it('reads an answer', () => {
    expect(parseStarttls(JSON.stringify(base))).toEqual(base);
  });

  it('reads the reason a dialog did not get to a handshake as part of the answer, not as a complaint', () => {
    const refused = {
      ...base,
      reachable: false,
      starttls: false,
      tlsVersion: null,
      trusted: false,
      hostnameMatches: false,
      certificates: [],
      error: 'not a public address',
    };
    expect(parseStarttls(JSON.stringify(refused))).toEqual(refused);
  });

  it('refuses a flag that is not true or false', () => {
    expect(() =>
      parseStarttls(JSON.stringify({ ...base, trusted: 1 })),
    ).toThrow('trusted is not true or false');
  });

  it('refuses certificates that are not a list', () => {
    expect(() =>
      parseStarttls(JSON.stringify({ ...base, certificates: 'x' })),
    ).toThrow('certificates is not a list');
  });
});

describe('parseReachable and parseOpenssl', () => {
  it('reads a connection test', () => {
    expect(parseReachable('{"reachable":true}')).toBe(true);
    expect(parseReachable('{"reachable":false}')).toBe(false);
    expect(() => parseReachable('{"reachable":"yes"}')).toThrow(ProbeError);
  });

  it('reads what openssl printed, as text, with the exit code', () => {
    const answer = parseOpenssl(
      JSON.stringify({
        stdout: toBase64('out'),
        stderr: toBase64('err'),
        code: 0,
        files: {},
      }),
    );
    expect(answer).toEqual({
      stdout: 'out',
      stderr: 'err',
      code: 0,
      files: {},
    });
    expect(
      parseOpenssl(
        JSON.stringify({
          stdout: toBase64(''),
          stderr: toBase64(''),
          code: null,
        }),
      ).code,
    ).toBeNull();
  });
});
