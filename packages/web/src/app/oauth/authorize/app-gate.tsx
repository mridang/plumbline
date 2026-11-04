/**
 * @packageDocumentation
 *
 * What this app asks of a signed-in person before the shared approval screen
 * (`page.tsx`) lets them connect an app. plumbline needs nothing more than the
 * sign-in itself: a connected app reaches the person's domains and reports,
 * which live in plumbline's own database.
 */

import type { ReactElement } from 'react';

import type { User } from '@/domain/auth/store';

/**
 * The screen to show instead of the approval, or null when the person may go
 * on to approve. Always null here: every signed-in person may approve.
 */
export const approvalGate: (
  user: Readonly<User>,
  returnTo: string,
) => ReactElement | null = () => null;
