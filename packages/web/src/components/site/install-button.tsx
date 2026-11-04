'use client';

import type { ReactElement } from 'react';

import { buttonClass } from '@/components/ui/button';

import { InstallIosHint } from '@/components/site/install-ios-hint';
import { useInstallPrompt } from '@/components/site/use-install-prompt';

/**
 * Offers to install the app where the browser can (Chromium's install prompt),
 * and explains how on iOS, where only Add to Home Screen does it.
 */
export function InstallButton(): ReactElement {
  const { install } = useInstallPrompt();
  return (
    <div className="flex items-center">
      {install ? (
        <button
          type="button"
          className={buttonClass({ variant: 'outline', size: 'sm' })}
          onClick={() => void install()}
        >
          Install app
        </button>
      ) : null}
      <div className="mx-auto max-w-sm rounded-control bg-paper text-ink empty:hidden">
        <InstallIosHint />
      </div>
    </div>
  );
}
