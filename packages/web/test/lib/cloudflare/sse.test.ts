import { describe, expect, test } from '@jest/globals';
import {
  encodeFrame,
  encodeHeartbeat,
  parseResume,
  SSE_HEADERS,
} from '@/lib/cloudflare/sse';

describe('sse', () => {
  test('encodes a frame with id, event and single-line data', () => {
    expect(encodeFrame({ id: 7, event: 'fact', data: { a: 'x\ny' } })).toBe(
      'id: 7\nevent: fact\ndata: {"a":"x\\ny"}\n\n',
    );
  });

  test('omits the parts a frame does not have', () => {
    expect(encodeFrame({ event: 'reset' })).toBe('event: reset\n\n');
  });

  test('encodes a heartbeat as a comment', () => {
    expect(encodeHeartbeat()).toBe(': heartbeat\n\n');
  });

  test('declares the event stream headers', () => {
    expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
    expect(SSE_HEADERS['Cache-Control']).toBe('no-cache');
  });

  test.each([
    ['12', undefined, 12],
    [null, '5', 5],
    ['3', '9', 3],
    ['abc', '9', 9],
    [undefined, undefined, null],
    ['-1', 'x', null],
    [' 4 ', null, 4],
  ])('parses resume from %p and %p as %p', (header, query, expected) => {
    expect(parseResume(header, query)).toBe(expected);
  });
});
