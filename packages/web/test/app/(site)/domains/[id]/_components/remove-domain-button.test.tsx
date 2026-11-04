import { describe, expect, it, jest } from '@jest/globals';

import {
  RemoveDomainButton,
  removeDomain,
} from '@/app/(site)/domains/[id]/_components/remove-domain-button';
import { ProblemError } from '@/components/api/problem-message';
import { htmlAt } from '../../../../../components/render';

describe('removeDomain', () => {
  it('deletes the domain', async () => {
    const transport = jest.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    );
    await removeDomain('d1', transport);
    expect(transport).toHaveBeenCalledWith('/api/domains/d1', {
      method: 'DELETE',
    });
  });

  it('rejects with the problem when the server refuses', async () => {
    const transport = jest.fn<typeof fetch>(async () =>
      Response.json(
        { title: 'Not Found', status: 404 },
        {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    await expect(removeDomain('d1', transport)).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});

describe('RemoveDomainButton', () => {
  const out = htmlAt(<RemoveDomainButton domainId="d1" host="example.com" />);

  it('is a button that removes the domain', () => {
    expect(out).toMatch(/<button type="button"[^>]*>Remove domain<\/button>/);
  });

  it('shows no problem before anything is tried', () => {
    expect(out).not.toContain('role="alert"');
  });
});
