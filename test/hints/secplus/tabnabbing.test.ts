import { describe, expect, it } from '@jest/globals';
import { runHint } from '../../helpers/run-hint.js';
import tabnabbing from '../../../src/hints/secplus/tabnabbing.js';

/** An HTML page with the given body, served as the scanned page. */
function page(body: string): string {
  return `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;
}

describe('the tabnabbing hint', () => {
  it('flags a cross-origin _blank link without rel=noopener', async () => {
    const problems = await runHint(tabnabbing, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page('<a target="_blank" href="https://evil.test/">go</a>'),
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('noopener');
  });

  it('accepts a cross-origin _blank link with rel=noopener', async () => {
    const problems = await runHint(tabnabbing, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page(
          '<a target="_blank" rel="noopener" href="https://evil.test/">go</a>',
        ),
      },
    });
    expect(problems).toHaveLength(0);
  });

  it('ignores a same-origin _blank link', async () => {
    const problems = await runHint(tabnabbing, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page('<a target="_blank" href="/local">go</a>'),
      },
    });
    expect(problems).toHaveLength(0);
  });

  it('reports one problem per unsafe link', async () => {
    const problems = await runHint(tabnabbing, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: page(
          '<a target="_blank" href="https://a.test/">a</a><a target="_blank" href="https://b.test/">b</a>',
        ),
      },
    });
    expect(problems).toHaveLength(2);
  });

  it('passes a page with no links', async () => {
    const problems = await runHint(tabnabbing);
    expect(problems).toHaveLength(0);
  });
});
