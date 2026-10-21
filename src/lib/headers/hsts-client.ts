/**
 * The client the HSTS hint uses to read the `Strict-Transport-Security`
 * header of a registrable domain. Tests replace `fetchHeader` with a fake so
 * they never touch the internet.
 */
export interface HstsClient {
  /**
   * Returns the header of `url`, null when the page answered without one and
   * undefined when the request failed.
   */
  fetchHeader(url: string): Promise<string | null | undefined>;
}

export const hstsClient: HstsClient = {
  async fetchHeader(url) {
    try {
      const response = await globalThis.fetch(url, { redirect: 'follow' });
      return response.headers.get('strict-transport-security');
    } catch {
      return undefined;
    }
  },
};
