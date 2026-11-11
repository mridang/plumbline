/**
 * Signs the person out: ends the session on the server, then goes to the front
 * page whether or not that request succeeded (a failed request must not leave
 * them stuck on a page that thinks they are still signed in).
 */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/sessions/self', { method: 'DELETE' });
  } catch {
    // Nothing to do about it here: the front page below shows what is true.
  }
  globalThis.location.assign('/');
}
