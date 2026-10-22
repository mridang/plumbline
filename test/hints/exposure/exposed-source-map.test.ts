import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/exposure/exposed-source-map.js';
import { runHint } from '../../helpers/run-hint.js';

const pageWith = (src: string): string =>
  `<!doctype html><html lang="en"><head><title>a</title><script src="${src}"></script></head><body></body></html>`;

const MAP = JSON.stringify({
  version: 3,
  sources: ['src/app.ts'],
  sourcesContent: ['const secret = 1;'],
  mappings: 'AAAA',
});

describe('exposed-source-map', () => {
  it('passes when the map is not reachable', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: pageWith('/app.js'),
      },
      '/app.js': {
        headers: { 'content-type': 'text/javascript' },
        body: 'console.log(1)',
      },
    });
    expect(problems).toEqual([]);
  });

  it('reports a reachable valid source map', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: pageWith('/app.js'),
      },
      '/app.js': {
        headers: { 'content-type': 'text/javascript' },
        body: 'console.log(1)',
      },
      '/app.js.map': {
        headers: { 'content-type': 'application/json' },
        body: MAP,
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].resource).toContain('/app.js.map');
  });

  it('does not flag a SPA index.html returned for the .map path', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: pageWith('/app.js'),
      },
      '/app.js': {
        headers: { 'content-type': 'text/javascript' },
        body: 'console.log(1)',
      },
      '/app.js.map': {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<!doctype html><html lang="en"><head><title>a</title></head><body></body></html>',
      },
    });
    expect(problems).toEqual([]);
  });
});
