import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-webmcp.js';
import { runHint } from '../../helpers/run-hint.js';
import { setEvaluate } from '../../helpers/test-connector.js';

afterEach(() => {
  setEvaluate(() => {
    throw new Error('evaluate is not configured for this test');
  });
});

describe('agent-webmcp', () => {
  it('passes when the site provides it', async () => {
    setEvaluate(() => ({ api: true, tools: 1, forms: 0 }));
    expect(await runHint(hint, {})).toEqual([]);
  });

  it('reports when the site does not', async () => {
    setEvaluate(() => ({ api: true, tools: 0, forms: 0 }));
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
