'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';

import {
  BoltIcon,
  ChevronIcon,
  LinkIcon,
  LogoutIcon,
  McpIcon,
} from '@/components/icons';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import {
  accountLinks,
  NOTHING_CONNECTED,
  type AccountLink,
  type AccountState,
} from '@/components/site/account-links';
import { signOut } from '@/components/site/sign-out';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  POPOVER_ITEM,
  Popover,
  PopoverLabel,
  PopoverSeparator,
} from '@/components/ui/popover';

/**
 * The person's Google photo, or their initial when there is none or it fails to
 * load. Google's photo host refuses requests that carry a referrer, hence the
 * referrer policy.
 */
export function Avatar({
  name,
  picture,
}: Readonly<{
  /** Their name; its first letter stands in for a missing photo. */
  name: string;
  /** The address of their Google profile photo, if they have one. */
  picture?: string | undefined;
}>): ReactElement {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-semibold text-white">
      {picture && !failed ? (
        <img
          src={picture}
          alt=""
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** An entry's wording and, when known, its status in words (never colour alone). */
function ItemLabel({ link }: Readonly<{ link: AccountLink }>): ReactElement {
  return (
    <>
      <span className="flex-1">{link.label}</span>
      {link.status ? (
        <span className="text-xs text-subtle">{link.status}</span>
      ) : null}
    </>
  );
}

/**
 * What the account menu holds: who is signed in, the GitHub connection,
 * connecting an assistant (MCP), the notification settings, and signing out.
 * Apart from the menu so it can be shown without opening one.
 */
export function AccountMenuItems({
  email,
  state = NOTHING_CONNECTED,
  onNotifications,
  onSignOut,
}: Readonly<{
  email: string;
  /** What the person has connected; words each entry. */
  state?: AccountState;
  /** Opens the notification settings. */
  onNotifications: () => void;
  onSignOut: () => void;
}>): ReactElement {
  const links = accountLinks(state);
  return (
    <>
      <PopoverLabel caption="Signed in as">{email}</PopoverLabel>
      <PopoverSeparator />
      <Link href="/github" className={POPOVER_ITEM}>
        <LinkIcon size="menu" className="text-subtle" />
        <ItemLabel link={links.github} />
      </Link>
      <Link href="/connect" className={POPOVER_ITEM}>
        <McpIcon size="menu" />
        <ItemLabel link={links.assistants} />
      </Link>
      <button type="button" className={POPOVER_ITEM} onClick={onNotifications}>
        <BoltIcon size="menu" className="text-subtle" />
        <ItemLabel link={links.notifications} />
      </button>
      <PopoverSeparator />
      <button type="button" className={POPOVER_ITEM} onClick={onSignOut}>
        <LogoutIcon size="menu" className="text-subtle" />
        Sign out
      </button>
    </>
  );
}

/**
 * The signed-in account control in the header. Closed, it is the person's
 * photo and "Hi Ada"; opened, it holds the GitHub connection, connecting an
 * assistant, the notification settings (in a dialog) and Sign out.
 */
export function AccountMenu({
  firstName,
  name,
  email,
  picture,
  state,
}: Readonly<{
  state?: AccountState;
  firstName: string;
  name: string;
  email: string;
  picture?: string | undefined;
}>): ReactElement {
  const [notifying, setNotifying] = useState(false);
  return (
    <>
      <Popover
        button={
          <>
            <Avatar name={name} picture={picture} />
            <span className="hidden text-sm font-semibold sm:block">
              Hi {firstName}
            </span>
            <ChevronIcon
              size="sm"
              className="hidden text-subtle transition group-data-[state=open]:rotate-180 sm:block"
            />
            <span className="sr-only sm:hidden">
              Account menu, signed in as {firstName}
            </span>
          </>
        }
        buttonClassName="group rounded-control hover:bg-ink/5 data-[state=open]:bg-ink/5 flex h-10 items-center gap-2 pr-2 pl-1 transition sm:pr-3 focus-ring-flush"
        panelClassName="w-64"
      >
        <AccountMenuItems
          email={email}
          {...(state ? { state } : {})}
          onNotifications={() => setNotifying(true)}
          onSignOut={() => void signOut()}
        />
      </Popover>
      {/* Outside the popover: the menu unmounts its items the moment one is chosen. */}
      <Dialog open={notifying} onOpenChange={setNotifying}>
        <DialogContent variant="center" className="max-w-lg p-6">
          <DialogTitle className="font-display text-xl font-semibold">
            Manage notifications
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">
            Be told when one of your sites changes.
          </DialogDescription>
          <div className="mt-4">
            <NotificationSettings />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
