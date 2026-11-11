import { afterAll, describe, expect, it, jest } from '@jest/globals';

/** The document the entry point finds: one with no `#root` to mount into. */
const querySelector = jest.fn<(id: string) => null>(() => null);
Object.assign(globalThis, { document: { querySelector } });

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('the report entry point', () => {
  it('looks for the element to mount into, and leaves a page without one alone', async () => {
    await import('@/views/report');
    expect(querySelector).toHaveBeenCalledWith('#root');
  });
});
