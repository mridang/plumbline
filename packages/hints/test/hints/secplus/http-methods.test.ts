import { describe, expect, it } from '@jest/globals';
import { runHint } from '../../helpers/run-hint.js';
import {
  httpMethodsHint,
  type OptionsRequester,
} from '../../../src/hints/secplus/http-methods.js';

/** A fake OPTIONS requester that always returns the given Allow header. */
function fakeRequester(allow: string | null): OptionsRequester {
  return () => Promise.resolve({ allow });
}

describe('the http-methods hint', () => {
  it('errors when TRACE is advertised', async () => {
    const problems = await runHint(
      httpMethodsHint(fakeRequester('GET, POST, TRACE')),
    );
    expect(problems.some((p) => p.message.includes('TRACE'))).toBe(true);
  });

  it('warns when write methods are advertised', async () => {
    const problems = await runHint(
      httpMethodsHint(fakeRequester('GET, PUT, DELETE')),
    );
    expect(problems.some((p) => p.message.includes('PUT'))).toBe(true);
  });

  it('passes a safe method set', async () => {
    const problems = await runHint(
      httpMethodsHint(fakeRequester('GET, HEAD, POST, OPTIONS')),
    );
    expect(problems).toHaveLength(0);
  });

  it('passes when the probe fails or sends no Allow', async () => {
    const problems = await runHint(
      httpMethodsHint(() => Promise.resolve(null)),
    );
    expect(problems).toHaveLength(0);
  });

  it('works against a locally served Allow header with the default requester', async () => {
    // The default requester sends a real OPTIONS request; the local test
    // server answers every method, so a route can supply the Allow header.
    const problems = await runHint(httpMethodsHint(), {
      '/': {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          allow: 'GET, TRACE',
        },
      },
    });
    expect(problems.some((p) => p.message.includes('TRACE'))).toBe(true);
  });
});
