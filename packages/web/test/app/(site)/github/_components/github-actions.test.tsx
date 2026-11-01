import { describe, expect, it, jest } from '@jest/globals';

import {
  DisconnectButton,
  SyncButton,
  postTo,
} from '@/app/(site)/github/_components/github-actions';
import { htmlAt } from '../../../../components/render';

describe('postTo', () => {
  it('posts to the path and resolves when GitHub endpoint answers ok', async () => {
    const transport = jest.fn(async () => new Response(null, { status: 204 }));
    await postTo('/api/github/sync', transport as unknown as typeof fetch);
    expect(transport).toHaveBeenCalledWith('/api/github/sync', {
      method: 'POST',
    });
  });

  it('rejects when the endpoint refuses', async () => {
    const transport = async () => new Response('{}', { status: 503 });
    await expect(
      postTo('/x', transport as unknown as typeof fetch),
    ).rejects.toBeDefined();
  });
});

describe('the buttons', () => {
  it('offer to refresh and to disconnect', () => {
    expect(htmlAt(<SyncButton />, { pathname: '/github' })).toContain(
      'Refresh from GitHub',
    );
    expect(htmlAt(<DisconnectButton />, { pathname: '/github' })).toContain(
      'Disconnect GitHub',
    );
  });
});
