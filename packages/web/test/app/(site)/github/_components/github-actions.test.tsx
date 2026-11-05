import { describe, expect, it, jest } from '@jest/globals';

import {
  DisconnectButton,
  callOn,
} from '@/app/(site)/github/_components/github-actions';
import { htmlAt } from '../../../../components/render';

describe('callOn', () => {
  it.each(['POST', 'DELETE'] as const)(
    'calls the path with %s and resolves when the endpoint answers ok',
    async (method) => {
      const transport = jest.fn<typeof fetch>(
        async () => new Response(null, { status: 204 }),
      );
      await callOn('/api/github/syncs', method, transport);
      expect(transport).toHaveBeenCalledWith('/api/github/syncs', { method });
    },
  );

  it('rejects when the endpoint refuses', async () => {
    const transport = async () => new Response('{}', { status: 503 });
    await expect(
      callOn('/x', 'POST', transport as unknown as typeof fetch),
    ).rejects.toBeDefined();
  });
});

describe('the buttons', () => {
  it('offer to disconnect', () => {
    expect(htmlAt(<DisconnectButton />, { pathname: '/github' })).toContain(
      'Disconnect GitHub',
    );
  });
});
