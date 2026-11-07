import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/csp-reporting.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string> = {}) => ({ '/': { headers } });
const group = (name: string, url: string) =>
  JSON.stringify({ group: name, max_age: 60, endpoints: [{ url }] });

describe('csp-reporting', () => {
  it('passes without reporting', async () => {
    expect(await runHint(hint, page())).toEqual([]);
  });

  it('passes first-party and relative endpoints', async () => {
    expect(
      await runHint(
        hint,
        page({
          'content-security-policy':
            "default-src 'self'; report-uri /csp-report",
        }),
      ),
    ).toEqual([]);
  });

  it('reports a third-party report-uri', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy':
          "default-src 'self'; report-uri https://r.example.net/c",
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      "content-security-policy: default-src 'self'; report-uri https://r.example.net/c",
    );
    expect(problems[0]?.message).toContain('https://r.example.net/c');
    expect(problems[0]?.message).toContain('Content-Security-Policy header');
  });

  it('reports a third-party report-uri in the report-only header', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy-report-only':
          "default-src 'self'; report-uri https://r.example.net/c",
      }),
    );
    expect(problems[0]?.message).toContain('Report-Only');
  });

  it('reports a third-party report-to group', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy': "default-src 'self'; report-to grp",
        'report-to': group('grp', 'https://r.example.net/c'),
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain("'report-to' group");
  });

  it('reports third-party NEL endpoints', async () => {
    const problems = await runHint(
      hint,
      page({
        nel: '{"report_to":"nel","max_age":60}',
        'report-to': group('nel', 'https://n.example.net/'),
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('NEL');
  });

  const cloudflareNel = {
    nel: JSON.stringify({ report_to: 'cf-nel', max_age: 604800 }),
    'report-to': group('cf-nel', 'https://a.nel.cloudflare.com/report/v4?s=x'),
  };

  it("passes Cloudflare's injected NEL endpoint on a site served by Cloudflare", async () => {
    expect(
      await runHint(
        hint,
        page({ ...cloudflareNel, server: 'cloudflare', 'cf-ray': 'abc-AMS' }),
      ),
    ).toEqual([]);
  });

  it("reports Cloudflare's NEL endpoint on a site not served by Cloudflare", async () => {
    const problems = await runHint(hint, page(cloudflareNel));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('a.nel.cloudflare.com');
  });

  it('still reports another third party on a site served by Cloudflare', async () => {
    const problems = await runHint(
      hint,
      page({
        server: 'cloudflare',
        'content-security-policy':
          "default-src 'self'; report-uri https://r.example.net/c",
      }),
    );
    expect(problems).toHaveLength(1);
  });
});
