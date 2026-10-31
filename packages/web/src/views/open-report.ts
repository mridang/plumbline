/**
 * @packageDocumentation
 *
 * What a row in the domain list sends to the assistant when it is tapped: a
 * fixed request for the domain's newest report. Only the host name goes into
 * the message, and only when it is shaped like one.
 */

/**
 * What a host name looks like: letters, digits, dots and hyphens. A domain is
 * the only thing a View puts into a message the person appears to have written,
 * so anything that is not shaped like one is never sent.
 */
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Whether `value` has the shape of a host name. */
export function isHostName(value: string): boolean {
  return HOST_PATTERN.test(value);
}

/**
 * The sentence a row sends to ask the assistant to show a domain's newest
 * report, or undefined when the host is not a plain host name (so nothing is
 * sent at all). A follow-up is shown as if the person had typed it, so it is a
 * fixed phrase plus the host, whose closed alphabet cannot carry instructions.
 */
export function openReportPrompt(host: string): string | undefined {
  return isHostName(host)
    ? `Show the latest plumbline report for ${host}`
    : undefined;
}
