import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/nel.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string>) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: '<!doctype html><html lang="en"><head><title>t</title></head><body></body></html>',
  },
});

describe('nel', () => {
  it('passes for a valid policy', async () => {
    expect(
      await runHint(
        hint,
        page({ nel: '{"report_to":"default","max_age":2592000}' }),
      ),
    ).toEqual([]);
  });

  it('warns on invalid JSON', async () => {
    const problems = await runHint(hint, page({ nel: 'not json' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('JSON');
  });

  it('warns when report_to is missing', async () => {
    const problems = await runHint(hint, page({ nel: '{"max_age":100}' }));
    expect(problems[0].message).toContain('report_to');
  });
});
