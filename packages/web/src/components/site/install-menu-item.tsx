'use client';

import type { ReactElement } from 'react';

import { useInstallPrompt } from '@/components/site/use-install-prompt';
import { POPOVER_ITEM } from '@/components/ui/popover';

/** "Add to home screen" as a menu entry, shown only when the browser offers to install. */
export function InstallMenuItem(): ReactElement | null {
  const { install } = useInstallPrompt();
  if (!install) {
    return null;
  }
  return (
    <button
      type="button"
      className={POPOVER_ITEM}
      onClick={() => void install()}
    >
      Add to home screen
    </button>
  );
}
