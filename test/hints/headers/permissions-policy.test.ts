import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/permissions-policy.js';
import { DISABLED_FEATURES } from '../../../src/lib/headers/permissions-policy.js';
import { runHint } from '../../helpers/run-hint.js';

const full = [
  ...DISABLED_FEATURES.map((f) => `${f}=()`),
  'sync-xhr=(self)',
].join(', ');
const page = (value?: string) => ({
  '/': {
    headers: (value ? { 'permissions-policy': value } : {}) as Record<
      string,
      string
    >,
  },
});

describe('permissions-policy', () => {
  it('passes when every feature is disabled', async () => {
    expect(await runHint(hint, page(full))).toEqual([]);
  });

  it('reports a missing header', async () => {
    const problems = await runHint(hint, page());
    expect(problems[0]?.sourceCode).toMatch(
      /^Permissions-Policy: accelerometer=\(\), /,
    );
    expect(problems[0]?.message).toContain('was not specified');
  });

  it('lists features that are not disabled', async () => {
    const problems = await runHint(hint, page('camera=(), microphone=(self)'));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      'Permissions-Policy: camera=(), microphone=(self)',
    );
    expect(problems[0]?.message).toContain('microphone');
    expect(problems[0]?.message).toContain('geolocation');
    expect(problems[0]?.message).not.toMatch(/ camera[,.]/);
  });
});
