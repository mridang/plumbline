import { describe, expect, it, jest } from '@jest/globals';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const { default: DomainsPage } = await import('@/app/(site)/domains/page');

describe('DomainsPage', () => {
  it('leads to the dashboard, which is the list of domains now', () => {
    expect(() => DomainsPage()).toThrow(new Redirected('/dashboard'));
  });
});
