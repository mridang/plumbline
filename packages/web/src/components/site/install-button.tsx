'use client';

import { buttonClass } from '@/components/ui/button';

import { InstallIosHint } from '@/components/site/install-ios-hint';
import { useInstallPrompt } from '@/components/site/use-install-prompt';
import type { ReactElement } from 'react';

/**
 * Offers to put the site on the desktop where the browser can (Chromium's
 * install prompt), as a quiet text button; and explains how on iOS, where only
 * Add to Home Screen does it. It is the browser's "install this site as an app",
 * which has nothing to do with installing the GitHub app, so the words say what
 * it does: "Add to desktop", and "Add to home screen" on a phone.
 */
export function InstallButton(): ReactElement {
  const { install } = useInstallPrompt();
  return (
    <div className="flex items-center">
      {install ? (
        <button
          type="button"
          className={buttonClass({
            variant: 'ghost',
            size: 'sm',
            // eslint-disable-next-line unicorn/no-keyword-prefix -- the Look prop is named className, as in React
            className: 'text-muted hover:text-ink',
          })}
          onClick={() => {
            void install();
          }}
        >
          <span className="sm:hidden">Add to home screen</span>
          <span className="hidden sm:inline">Add to desktop</span>
        </button>
      ) : null}
      <div className="mx-auto max-w-sm rounded-control bg-paper text-ink empty:hidden">
        <InstallIosHint />
      </div>
    </div>
  );
}
