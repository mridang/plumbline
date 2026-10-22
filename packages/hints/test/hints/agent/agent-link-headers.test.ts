import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/agent/agent-link-headers.js';
import { runHint, type Routes } from '../../helpers/run-hint.js';

const routes: Routes = {
  '/': {
    headers: {
      'content-type': 'text/html',
      link: '</.well-known/api-catalog>; rel="api-catalog"',
    },
    body: '',
  },
};

describe('agent-link-headers', () => {
  it('passes when the site provides it', async () => {
    expect(await runHint(hint, routes)).toEqual([]);
  });

  it('reports when the site does not', async () => {
    const problems = await runHint(hint, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].resource.endsWith('/')).toBe(true);
    expect(problems[0].sourceCode).toContain(
      'Link: </.well-known/api-catalog>; rel="api-catalog"',
    );
    expect(problems[0].codeLanguage).toBe('http');
  });

  it('shows the Link header that has no useful relation', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: {
          'content-type': 'text/html',
          link: '</a.css>; rel="preload"',
        },
        body: '',
      },
    });
    expect(problems[0].sourceCode).toBe('Link: </a.css>; rel="preload"');
    expect(problems[0].codeLanguage).toBe('http');
  });
});
