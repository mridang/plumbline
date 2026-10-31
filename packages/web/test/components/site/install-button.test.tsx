import { describe, expect, it } from '@jest/globals';

import { InstallButton } from '@/components/site/install-button';
import { html } from '../render';

describe('InstallButton', () => {
  it('shows nothing to press until the browser offers to install', () => {
    expect(html(<InstallButton />)).not.toContain('<button');
  });
});
