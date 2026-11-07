/**
 * What is said about who may turn the checks of a repository off. The server
 * answers with the first text and the page shows both next to the switch, so
 * the words live in one place.
 */

/** Why someone who can see a repository cannot flip its switch. */
export const NOT_INSTALLER =
  'Only the person who installed the app for this repository can switch its checks off.';

/** Why the switch is read-only when the repository's own file turns checks off. */
export const TURNED_OFF_IN_FILE = 'Turned off in plumbline.yaml';

/** What to do about it, shown beside the reason. */
export const TURNED_OFF_IN_FILE_HELP =
  'Set enabled: true in plumbline.yaml (or remove the key) to turn checks back on.';
