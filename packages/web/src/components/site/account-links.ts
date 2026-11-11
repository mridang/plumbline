/**
 * The words of the account menu, and of the pages it opens, in one place so one
 * thing is never called two names. Every entry is named for what it lets the
 * person do: "Manage …" once the thing is connected, "Connect …" before.
 */

/** What is known about the signed-in person's connections. */
export interface AccountState {
  /** Their GitHub account is linked. */
  github: boolean;
  /** At least one assistant (MCP client) has been approved and not revoked. */
  assistants: boolean;
}

/** One entry of the account menu. */
export interface AccountLink {
  /** The entry's wording. */
  label: string;
  /** Whether the thing is connected; undefined when that is not known. */
  connected: boolean | undefined;
  /** The status marker shown beside the label, in words; undefined when unknown. */
  status: 'Connected' | 'Not connected' | undefined;
}

/** The nouns, as the menu, headings, titles and buttons all say them. */
export const NAMES = {
  github: 'GitHub',
  assistants: 'assistants (MCP)',
  assistant: 'an assistant (MCP)',
  notifications: 'notifications',
} as const;

const entry = ({
  label,
  connected,
}: Readonly<{ label: string; connected?: boolean }>): AccountLink => {
  let status: AccountLink['status'];
  if (connected !== undefined) {
    status = connected ? 'Connected' : 'Not connected';
  }
  return { label, connected, status };
};

/** The three connection entries for the state. Notifications are per device, so never known here. */
export function accountLinks(state: AccountState): {
  github: AccountLink;
  assistants: AccountLink;
  notifications: AccountLink;
} {
  return {
    github: entry({
      label: state.github
        ? `Manage ${NAMES.github}`
        : `Connect ${NAMES.github}`,
      connected: state.github,
    }),
    assistants: entry({
      label: state.assistants
        ? `Manage ${NAMES.assistants}`
        : `Connect ${NAMES.assistant}`,
      connected: state.assistants,
    }),
    notifications: entry({ label: `Manage ${NAMES.notifications}` }),
  };
}

/** Before anything is known (or for a test): nothing connected. */
export const NOTHING_CONNECTED: AccountState = {
  github: false,
  assistants: false,
};
