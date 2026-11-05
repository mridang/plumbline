import { describe, expect, it, jest } from '@jest/globals';

import { html } from '../render';

/** What the install hook says: nothing to install until `installable` is set. */
const prompt: { installable: boolean } = { installable: false };

jest.unstable_mockModule('@/components/site/use-install-prompt', () => ({
  useInstallPrompt: () =>
    prompt.installable ? { install: async () => undefined } : {},
}));

const { InstallMenuItem } = await import('@/components/site/install-menu-item');

describe('InstallMenuItem', () => {
  it('draws nothing until the browser offers to install', () => {
    prompt.installable = false;
    expect(html(<InstallMenuItem />)).toBe('');
  });

  it('then offers Add to home screen', () => {
    prompt.installable = true;
    expect(html(<InstallMenuItem />)).toContain('>Add to home screen<');
  });
});
