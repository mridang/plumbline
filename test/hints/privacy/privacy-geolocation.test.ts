import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/privacy/privacy-geolocation.js';
import { runHint } from '../../helpers/run-hint.js';

const html = (body: string) => ({
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body: `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`,
});

describe('privacy-geolocation', () => {
  it('passes when no script uses geolocation', async () => {
    expect(
      await runHint(hint, {
        '/': html('<script>var a = 1;</script><script src="/a.js"></script>'),
        '/a.js': { body: 'var b = 2;' },
      }),
    ).toEqual([]);
  });

  it('reports an inline script', async () => {
    const problems = await runHint(hint, {
      '/': html('<script>navigator.geolocation.getCurrentPosition(f)</script>'),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('inline script');
  });

  it('reports a fetched script', async () => {
    const problems = await runHint(hint, {
      '/': html('<script src="/geo.js"></script>'),
      '/geo.js': { body: 'navigator.geolocation.watchPosition(f)' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('/geo.js');
  });

  it('does not report feature detection or comments', async () => {
    expect(
      await runHint(hint, {
        '/': html(
          '<script>if (navigator.geolocation) { show(); } // navigator.geolocation.watchPosition(f)</script>',
        ),
      }),
    ).toEqual([]);
  });

  it('reports an aliased call', async () => {
    const problems = await runHint(hint, {
      '/': html(
        '<script>const { geolocation: g } = navigator; g.getCurrentPosition(f)</script>',
      ),
    });
    expect(problems).toHaveLength(1);
  });
});
