import {
  NOT_INSTALLER,
  TURNED_OFF_IN_FILE,
  TURNED_OFF_IN_FILE_HELP,
} from '@/components/repos/checks-messages';

/** What the viewer may do with a repository's checks switch. */
export interface ChecksControl {
  /** Whether they installed the app for the repository (only they may flip the switch). */
  readonly canManage: boolean;
  /** Whether the repository's `plumbline.yaml` turns checks off (the file decides). */
  readonly fileOff: boolean;
}

/**
 * Why the switch cannot be flipped, or null when it can. The file wins: while
 * it says `enabled: false` nobody can switch checks on from here, even the
 * installer.
 */
export function lockedReason(control: Readonly<ChecksControl>): string | null {
  if (control.fileOff) {
    return `${TURNED_OFF_IN_FILE}. ${TURNED_OFF_IN_FILE_HELP}`;
  }
  return control.canManage ? null : NOT_INSTALLER;
}

/** The control of a repository, from the sets the page loaded. */
export function controlOf(
  repo: string | null,
  manageable: ReadonlySet<string>,
  fileOff: ReadonlySet<string>,
): ChecksControl {
  return {
    canManage: repo !== null && manageable.has(repo),
    fileOff: repo !== null && fileOff.has(repo),
  };
}
