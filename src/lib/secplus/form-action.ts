/**
 * Insecure form submission.
 *
 * A `<form>` on an HTTPS page whose `action` points at an `http://` URL submits
 * the user's input in clear text, and the browser's "insecure form submission"
 * warning interrupts the user. The whole value of serving the page over HTTPS
 * is lost at the moment the form is sent. This mirrors the "mixed form" check
 * browsers ship and the OWASP transport-security guidance.
 *
 * A form with no `action` (or a relative one) submits back to the page's own
 * URL, which is HTTPS, so it is safe. A form on a plain-HTTP page is already
 * insecure for other reasons and is out of scope here (the page itself should
 * be on HTTPS), so this check only fires on an HTTPS page.
 *
 * Reference: MDN "Insecure forms"
 * (https://developer.mozilla.org/docs/Web/Security/Insecure_passwords#insecure_forms)
 * and the browser mixed-content form behaviour.
 */
import { finding, type Finding } from '../headers/finding.js';

/** The one form attribute this check reads. */
export interface FormLike {
  /** The `action` attribute value (may be relative), or null when absent. */
  action: string | null;
}

/**
 * True when a form on `pageUrl` submits over plain HTTP. Only meaningful for
 * an HTTPS page; a non-HTTPS page returns false (out of scope). A relative or
 * absent action resolves to the page's own HTTPS URL and is safe.
 */
export function isInsecureFormAction(
  action: string | null,
  pageUrl: string,
): boolean {
  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return false;
  }
  if (page.protocol !== 'https:') {
    return false;
  }
  if (!action || action.trim() === '') {
    return false;
  }
  let target: URL;
  try {
    target = new URL(action, pageUrl);
  } catch {
    return false;
  }
  return target.protocol === 'http:';
}

/** The finding for one form, or null when it submits securely. */
export function formActionFinding(
  form: FormLike,
  pageUrl: string,
): Finding | null {
  if (!isInsecureFormAction(form.action, pageUrl)) {
    return null;
  }
  return finding(
    'error',
    `Form submits to the insecure URL ${form.action} from an HTTPS page; the data is sent in clear text and the browser warns the user. Use an https:// action.`,
  );
}

/** Findings for every form on the page, one per insecure submission. */
export function formActionFindings(
  forms: readonly FormLike[],
  pageUrl: string,
): Finding[] {
  return forms
    .map((form) => formActionFinding(form, pageUrl))
    .filter((found): found is Finding => found !== null);
}
