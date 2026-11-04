import { describe, expect, it, jest } from '@jest/globals';

import { ConfirmDialog } from '@/components/site/confirm-dialog';
import { html } from '../render';

/** A confirmation, open or closed as told. */
const sample = (open: boolean) =>
  html(
    <ConfirmDialog
      open={open}
      onOpenChange={jest.fn()}
      title="Remove example.com?"
      description="The domain and all of its reports will be removed."
      confirmLabel="Remove domain"
      onConfirm={jest.fn()}
    />,
  );

describe('ConfirmDialog', () => {
  it('asks the question and offers Cancel and the confirming button when open', () => {
    const out = sample(true);
    expect(out).toContain('Remove example.com?');
    expect(out).toContain('The domain and all of its reports will be removed.');
    expect(out).toContain('Cancel');
    expect(out).toContain('Remove domain');
  });

  it('is a native modal dialog that cannot be dismissed by accident', () => {
    expect(sample(true)).toMatch(/<dialog[^>]*closedby="any"/);
  });

  it('shows nothing of the question while closed', () => {
    expect(sample(false)).not.toContain('Remove example.com?');
  });
});
