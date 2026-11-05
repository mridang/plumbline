import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { serverNow } from '@/lib/clock';

afterEach(() => {
  jest.useRealTimers();
});

describe('serverNow', () => {
  it('is the time now, in milliseconds', () => {
    jest.useFakeTimers({ now: new Date('2026-11-05T12:00:00.000Z') });
    expect(serverNow()).toBe(Date.parse('2026-11-05T12:00:00.000Z'));
  });
});
