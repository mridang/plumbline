import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headersx/attribution-reporting.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('attribution-reporting', () => {
  it('is silent when neither header is present', async () => {
    expect(await runHint(hint, page({}))).toEqual([]);
  });

  it('reports participation for a valid registration', async () => {
    const problems = await runHint(
      hint,
      page({ 'attribution-reporting-register-source': '{"x":1}' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('Attribution Reporting');
  });

  it('warns on an invalid registration', async () => {
    const problems = await runHint(
      hint,
      page({ 'attribution-reporting-register-trigger': 'nope' }),
    );
    expect(problems[0].message).toContain('valid JSON');
  });
});
