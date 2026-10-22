import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/critical-ch.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('critical-ch', () => {
  it('passes for a subset of Accept-CH', async () => {
    expect(
      await runHint(
        hint,
        page({
          'accept-ch': 'Sec-CH-UA, Sec-CH-UA-Mobile',
          'critical-ch': 'Sec-CH-UA',
        }),
      ),
    ).toEqual([]);
  });

  it('errors on a hint missing from Accept-CH', async () => {
    const problems = await runHint(
      hint,
      page({ 'accept-ch': 'Sec-CH-UA', 'critical-ch': 'Sec-CH-UA-Platform' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('Sec-CH-UA-Platform');
  });
});
