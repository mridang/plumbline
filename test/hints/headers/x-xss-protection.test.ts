import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-xss-protection.js';
import { Severity } from '@hint/utils-types';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string> = {}) => ({ '/': { headers } });

describe('x-xss-protection', () => {
  it('passes when the header is absent', async () => {
    expect(await runHint(hint, page())).toEqual([]);
  });

  it('reports an enabled header and suggests a CSP when there is none', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-xss-protection': '1; mode=block' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain(
      'use a Content Security Policy instead',
    );
  });

  it('says the header is unnecessary next to a passing CSP', async () => {
    const problems = await runHint(
      hint,
      page({
        'x-xss-protection': '1',
        'content-security-policy': "default-src 'none'",
      }),
    );
    expect(problems[0]?.message).toContain(
      'not needed because a Content Security Policy',
    );
  });

  it('only warns when the filter is disabled with 0', async () => {
    const problems = await runHint(hint, page({ 'x-xss-protection': '0' }));
    expect(problems[0]?.message).toContain('disables');
    expect(problems[0]?.severity).toBe(Severity.warning);
  });

  it('reports an invalid value', async () => {
    const problems = await runHint(hint, page({ 'x-xss-protection': 'on' }));
    expect(problems[0]?.message).toContain('cannot be recognized');
  });
});
