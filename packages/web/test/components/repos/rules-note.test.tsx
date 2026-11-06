import { describe, expect, it } from '@jest/globals';

import { RulesNote } from '@/components/repos/rules-note';
import { html } from '../render';

describe('RulesNote', () => {
  it('says which checks the results cover and where the rules come from', () => {
    const out = html(<RulesNote repo="acme/site" checks={155} />);
    expect(out).toContain(
      'These results cover the 155 checks your rules turn on',
    );
    expect(out).toContain('plumbline.yaml');
    expect(out).toContain('acme/site');
    expect(out).toContain('plumbline:recommended');
  });

  it('says how to check more: commit a plumbline.yaml', () => {
    const out = html(<RulesNote repo="acme/site" />);
    expect(out).toContain('commit a');
    expect(out).toContain('plumbline:advanced');
    expect(out).toContain('Only the checks your rules turn on are shown');
  });

  it('links to the rule sets and to the schema', () => {
    const out = html(<RulesNote repo="acme/site" />);
    expect(out).toContain('href="/checks"');
    expect(out).toContain('href="/schemas/plumbline.schema.json"');
  });

  it('uses no colour of failure', () => {
    expect(html(<RulesNote repo="acme/site" />)).not.toContain('text-failed');
  });
});
