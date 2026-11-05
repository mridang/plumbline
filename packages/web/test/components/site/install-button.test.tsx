import { describe, expect, it, jest } from '@jest/globals';

import { html } from '../render';

/** What the install hook says: nothing to install until `installable` is set. */
const prompt: { installable: boolean } = { installable: false };

jest.unstable_mockModule('@/components/site/use-install-prompt', () => ({
  useInstallPrompt: () =>
    prompt.installable ? { install: async () => undefined } : {},
}));

const { InstallButton } = await import('@/components/site/install-button');

describe('InstallButton', () => {
  it('shows nothing to press until the browser offers to install', () => {
    prompt.installable = false;
    expect(html(<InstallButton />)).not.toContain('<button');
  });

  it('says what it does: Add to desktop, and Add to home screen on a phone', () => {
    prompt.installable = true;
    const out = html(<InstallButton />);
    expect(out).toContain('>Add to desktop<');
    expect(out).toContain('>Add to home screen<');
    expect(out).not.toContain('Install app');
  });

  it('is a quiet text button, not an outlined one', () => {
    prompt.installable = true;
    const out = html(<InstallButton />);
    expect(out).toContain('text-muted');
    expect(out).not.toContain('border-field');
  });
});
