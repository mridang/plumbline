import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/cookies.js';
import { Severity } from '@hint/utils-types';
import { runHint } from '../../helpers/run-hint.js';

const page = (cookie?: string) => ({
  '/': {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(cookie ? { 'set-cookie': cookie } : {}),
    },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('cookies', () => {
  it('passes without cookies', async () => {
    expect(await runHint(hint, page())).toEqual([]);
  });

  it('passes well formed cookies', async () => {
    expect(
      await runHint(
        hint,
        page('sessionid=1; Secure; HttpOnly; SameSite=Strict'),
      ),
    ).toEqual([]);
  });

  it('suggests SameSite', async () => {
    const problems = await runHint(hint, page('a=1; Secure; HttpOnly'));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('Use SameSite');
  });

  it('reports a cookie without Secure', async () => {
    const problems = await runHint(hint, page('a=1; HttpOnly; SameSite=Lax'));
    expect(problems[0]?.message).toContain('without using the Secure flag');
  });

  it('reports a session cookie without Secure', async () => {
    const problems = await runHint(
      hint,
      page('sessionid=1; HttpOnly; SameSite=Lax'),
    );
    expect(problems[0]?.message).toContain(
      'Session cookie set without using the Secure flag',
    );
  });

  it('reports a session cookie without HttpOnly', async () => {
    const problems = await runHint(
      hint,
      page('sessionid=1; Secure; SameSite=Lax'),
    );
    expect(problems[0]?.message).toContain('HttpOnly');
  });

  it('reports an anti-CSRF cookie without SameSite', async () => {
    const problems = await runHint(hint, page('csrftoken=1; Secure; HttpOnly'));
    expect(problems[0]?.message).toContain('Anti-CSRF');
  });

  it('reports an invalid SameSite value', async () => {
    const problems = await runHint(
      hint,
      page('a=1; Secure; SameSite=Sideways'),
    );
    expect(problems[0]?.message).toContain('SameSite');
  });

  it('never counts HSTS over a plain http page', async () => {
    const routes = {
      '/': {
        headers: {
          'set-cookie': 'a=1; SameSite=Lax',
          'strict-transport-security': 'max-age=31536000',
        },
      },
    };
    const problems = await runHint(hint, routes);
    expect(problems[0]?.message).toContain('Secure flag or set over HTTP');
    expect(problems[0]?.severity).toBe(Severity.error);
  });
});
