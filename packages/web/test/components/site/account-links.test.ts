import { describe, expect, it } from '@jest/globals';

import {
  accountLinks,
  NOTHING_CONNECTED,
} from '@/components/site/account-links';

describe('accountLinks', () => {
  it('says Connect for what is not connected yet', () => {
    const links = accountLinks(NOTHING_CONNECTED);
    expect(links.github).toMatchObject({
      label: 'Connect GitHub',
      status: 'Not connected',
    });
    expect(links.assistants).toMatchObject({
      label: 'Connect an assistant (MCP)',
      status: 'Not connected',
    });
  });

  it('says Manage for what is connected', () => {
    const links = accountLinks({ github: true, assistants: true });
    expect(links.github).toMatchObject({
      label: 'Manage GitHub',
      status: 'Connected',
    });
    expect(links.assistants).toMatchObject({
      label: 'Manage assistants (MCP)',
      status: 'Connected',
    });
  });

  it('words each entry on its own state', () => {
    const links = accountLinks({ github: true, assistants: false });
    expect(links.github.label).toBe('Manage GitHub');
    expect(links.assistants.label).toBe('Connect an assistant (MCP)');
  });

  it('keeps notifications neutral, with no status, as they are per device', () => {
    expect(accountLinks(NOTHING_CONNECTED).notifications).toEqual({
      label: 'Manage notifications',
      connected: undefined,
      status: undefined,
    });
  });
});
