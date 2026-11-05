import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { signOut } from '@/components/site/sign-out';

describe('signing out', () => {
  const assign = jest.fn();

  afterEach(() => {
    jest.restoreAllMocks();
    assign.mockClear();
    Reflect.deleteProperty(globalThis, 'window');
  });

  /** Sign out with a stand-in browser, and wait for it to finish. */
  async function run(fetchResult: Promise<Response>): Promise<jest.Mock> {
    const fetchSpy = jest.fn(() => fetchResult);
    Object.assign(globalThis, {
      window: { location: { assign } },
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchSpy as never);
    await signOut();
    return fetchSpy;
  }

  it('ends the session on the server, then goes to the front page', async () => {
    const fetchSpy = await run(
      Promise.resolve(new Response(null, { status: 204 })),
    );
    expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/self', {
      method: 'DELETE',
    });
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('goes to the front page even when the request fails', async () => {
    await run(Promise.reject(new Error('offline')));
    expect(assign).toHaveBeenCalledWith('/');
  });
});
