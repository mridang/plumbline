import { runSuite, type SuiteRun } from '@/domain/suite/run';

const fetcher = (html: string) => async () =>
  new Response(html, { headers: { 'content-type': 'text/html' } });

/** Runs the suite over `html` as if a site at https://example.com/ had sent it. */
export function runOnHtml(html: string): Promise<SuiteRun> {
  return runSuite('https://example.com/', null, fetcher(html));
}

/** Runs the suite twice over the same `html`, the second time given the first run's hash. */
export async function runTwice(
  html: string,
): Promise<{ first: SuiteRun; second: SuiteRun }> {
  const first = await runOnHtml(html);
  const second = await runSuite(
    'https://example.com/',
    first.hash,
    fetcher(html),
  );
  return { first, second };
}
