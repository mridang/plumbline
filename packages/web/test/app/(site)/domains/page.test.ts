import { describe, expect, it, jest } from '@jest/globals';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class RedirectedError extends Error {
  override name = 'RedirectedError';
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectedError(to);
  },
}));

const { default: DomainsPage } = await import('@/app/(site)/domains/page');

describe('DomainsPage', () => {
  it('leads to the dashboard, which is the list of domains now', () => {
    expect(() => DomainsPage()).toThrow(new RedirectedError('/dashboard'));
  });
});
