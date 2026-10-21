import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-sitemap.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/sitemap.xml': {
    headers: { 'content-type': 'application/xml' },
    body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
  },
};

describe('agent-sitemap', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource.endsWith('/sitemap.xml')).toBe(true);
    expect(problems[0].sourceCode).toContain('<urlset');
  });
});
