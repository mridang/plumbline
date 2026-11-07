import { describe, expect, it } from '@jest/globals';

import DocsPage, { metadata } from '@/app/(site)/docs/page';
import { WAYS_IN } from '@/components/landing/ways-in';
import { htmlAt } from '../../../components/render';

describe('the docs page', () => {
  const out = htmlAt(<DocsPage />, { pathname: '/docs' });

  it('may be indexed', () => {
    expect(metadata.title).toBe('Docs');
    expect(metadata.alternates?.canonical).toContain('/docs');
  });

  it('shows each way to run the checks with its command', () => {
    for (const way of WAYS_IN) {
      expect(out).toContain(way.title);
    }
    expect(out).toContain('npx @mridang/plumbline scan example.com');
  });

  it('points to the API description and the MCP server', () => {
    expect(out).toContain('openapi.json');
    expect(out).toContain('/mcp');
  });

  it('documents the rules file, its keys and the rule sets', () => {
    expect(out).toContain('plumbline.yaml');
    for (const key of [
      'extends',
      'rules',
      'environments',
      'issues',
      'dispatch',
      'enabled',
    ]) {
      expect(out).toContain(`>${key}</dt>`);
    }
    expect(out).toContain('plumbline:recommended');
    expect(out).toContain('plumbline:advanced');
  });

  it('links the JSON schema and shows the line that makes an editor use it', () => {
    expect(out).toContain('href="/schemas/plumbline.schema.json"');
    expect(out).toContain(
      '# yaml-language-server: $schema=https://plumbline.apps.mrida.ng/schemas/plumbline.schema.json',
    );
  });
});
