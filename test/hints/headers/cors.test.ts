import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cors.js';
import { runHint } from '../../helpers/run-hint.js';

const reflecting = (credentials: string | null) => ({
  '/': (req: { headers: Record<string, string | string[] | undefined> }) => ({
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': String(req.headers.origin ?? 'none'),
      ...(credentials
        ? { 'access-control-allow-credentials': credentials }
        : {}),
    },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  }),
});

describe('cors', () => {
  it('passes when CORS is not implemented', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('gives information about public access', async () => {
    const problems = await runHint(hint, {
      '/': { headers: { 'access-control-allow-origin': '*' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe('Access-Control-Allow-Origin: *');
    expect(problems[0]?.message).toContain('Public content');
  });

  it('passes when access is restricted to one origin', async () => {
    expect(
      await runHint(hint, {
        '/': {
          headers: { 'access-control-allow-origin': 'https://partner.example' },
        },
      }),
    ).toEqual([]);
  });

  it('reports a reflected origin with credentials', async () => {
    const problems = await runHint(hint, reflecting('true'));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('vulnerable to CSRF');
  });

  it('passes a reflected origin without credentials', async () => {
    expect(await runHint(hint, reflecting(null))).toEqual([]);
  });
});
