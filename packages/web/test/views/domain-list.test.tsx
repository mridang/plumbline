import { afterAll, describe, expect, it, jest } from '@jest/globals';

/** The document the entry point finds: one with no `#root` to mount into. */
const querySelector = jest.fn<(id: string) => null>(() => null);
Object.assign(globalThis, { document: { querySelector } });

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('the domain list entry point', () => {
  it('looks for the element to mount into, and leaves a page without one alone', async () => {
    await import('@/views/domain-list');
    expect(querySelector).toHaveBeenCalledWith('#root');
  });
});
