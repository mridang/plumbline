import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/clear-site-data.js';
import { runHint } from '../../helpers/run-hint.js';

const options = { hintOptions: { logoutUrl: '/logout' } };

describe('clear-site-data', () => {
  it('reports nothing without a logoutUrl', async () => {
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('passes the OWASP value', async () => {
    const routes = {
      '/logout': {
        headers: { 'clear-site-data': '"cache","cookies","storage"' },
      },
    };
    expect(await runHint(hint, routes, options)).toEqual([]);
  });

  it('ignores spaces between the values', async () => {
    const routes = {
      '/logout': {
        headers: { 'clear-site-data': '"cache", "cookies", "storage"' },
      },
    };
    expect(await runHint(hint, routes, options)).toEqual([]);
  });

  it('reports a missing header', async () => {
    const problems = await runHint(hint, { '/logout': {} }, options);
    expect(problems[0]?.sourceCode).toBe(
      'Clear-Site-Data: "cache","cookies","storage"',
    );
    expect(problems[0]?.message).toContain('was not specified');
  });

  it('reports a different value', async () => {
    const problems = await runHint(
      hint,
      { '/logout': { headers: { 'clear-site-data': '"cookies"' } } },
      options,
    );
    expect(problems[0]?.sourceCode).toBe('Clear-Site-Data: "cookies"');
    expect(problems[0]?.message).toContain('should be');
  });

  it('reports a logout URL that does not answer 200', async () => {
    const problems = await runHint(hint, {}, options);
    expect(problems[0]?.message).toContain('answered 404 instead of 200');
  });
});
