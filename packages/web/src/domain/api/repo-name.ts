/**
 * @packageDocumentation
 *
 * The name of a GitHub repository as it appears in an address: an owner and a
 * name, checked against GitHub's own rules.
 */

/** A GitHub owner: letters, digits and single hyphens. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** A GitHub repository name: letters, digits, dots, underscores and hyphens. */
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * The repository the path names (`owner/name`), or null when it cannot be one
 * (a name that does not match GitHub's, or `.` and `..`).
 */
export function repoOf(owner: string, name: string): string | null {
  return OWNER.test(owner) && NAME.test(name) && !/^\.+$/.test(name)
    ? `${owner}/${name}`
    : null;
}
