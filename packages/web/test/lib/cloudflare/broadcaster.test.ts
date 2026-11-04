import { describe, expect, jest, test } from '@jest/globals';
import { Broadcaster, type HubNamespace } from '@/lib/cloudflare/broadcaster';

describe('Broadcaster', () => {
  test('wakes the hub named after the repository', async () => {
    const notify = jest
      .fn<(id: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const names: string[] = [];
    const hubs = {
      idFromName: (name: string) => {
        names.push(name);
        return name;
      },
      get: () => ({ notify, fetch: async () => new Response() }),
    } as unknown as HubNamespace;
    await new Broadcaster(hubs).notify('7');
    expect(names).toEqual(['7']);
    expect(notify).toHaveBeenCalledWith('7');
  });

  test.each([
    [
      'cannot be found',
      {
        idFromName: () => {
          throw new Error('hub down');
        },
        get: () => ({}),
      },
    ],
    [
      'rejects the call',
      {
        idFromName: (name: string) => name,
        get: () => ({
          notify: async () => {
            throw new Error('overloaded');
          },
        }),
      },
    ],
  ])('never fails the caller when the hub %s', async (_label, hubs) => {
    await expect(
      new Broadcaster(hubs as unknown as HubNamespace).notify('7'),
    ).resolves.toBeUndefined();
  });
});
