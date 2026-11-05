import { describe, expect, it, jest } from '@jest/globals';

import { setRepoHidden } from '@/components/repos/hide-repo';

describe('setRepoHidden', () => {
  it.each([
    [true, 'PUT'],
    [false, 'DELETE'],
  ] as const)(
    'calls the repository’s address with the right method for hidden=%s',
    async (hidden, method) => {
      const transport = jest.fn<typeof fetch>(
        async () => new Response(null, { status: 204 }),
      );
      await setRepoHidden('acme/site', hidden, transport);
      expect(transport).toHaveBeenCalledWith(
        '/api/users/self/repositories/hidden/acme/site',
        { method },
      );
    },
  );

  it('rejects when the server refuses', async () => {
    const transport = async () => new Response('{}', { status: 404 });
    await expect(
      setRepoHidden('acme/site', true, transport as unknown as typeof fetch),
    ).rejects.toBeDefined();
  });
});
