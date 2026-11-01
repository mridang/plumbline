import { runSuite, type SuiteRun } from '@/domain/suite/run';

/** Runs the suite over `html` as if a site at https://example.com/ had sent it. */
export function runOnHtml(html: string): Promise<SuiteRun> {
  return runSuite('https://example.com/', async () => {
    return new Response(html, {
      headers: { 'content-type': 'text/html' },
    });
  });
}
