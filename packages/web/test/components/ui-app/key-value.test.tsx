import { describe, expect, it } from '@jest/globals';

import { KeyValue } from '@/components/ui-app/key-value';
import { html } from '../render';

describe('KeyValue', () => {
  it('lists each fact as a term and its value', () => {
    const out = html(
      <KeyValue
        facts={[
          { label: 'GitHub', value: 'ada' },
          { label: 'Signed in as', value: <b>ada@example.com</b> },
        ]}
      />,
    );
    expect(out).toContain('>GitHub</dt>');
    expect(out).toContain('>ada</dd>');
    expect(out).toContain('<b>ada@example.com</b>');
  });
});
