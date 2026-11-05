import { describe, expect, it, jest } from '@jest/globals';

import {
  CheckForm,
  checksToSend,
  saveChecks,
  type CheckSection,
} from '@/components/repos/check-form';
import { ProblemError } from '@/components/api/problem-message';
import { htmlAt } from '../render';

const SECTIONS: readonly CheckSection[] = [
  {
    id: 'site-protection',
    title: 'Site protection',
    checks: [
      { id: 'csp', name: 'Content Security Policy', description: 'CSP.' },
      { id: 'etag', name: 'ETag', description: 'ETag.' },
    ],
  },
  {
    id: 'dns',
    title: 'DNS',
    checks: [{ id: 'dnssec', name: 'DNSSEC', description: 'Signed.' }],
  },
];

describe('checksToSend', () => {
  it('sends null when every check is ticked, so checks added later run too', () => {
    expect(checksToSend(new Set(['a', 'b']), 2)).toBeNull();
  });

  it('sends the ticked ids, sorted', () => {
    expect(checksToSend(new Set(['b', 'a']), 3)).toEqual(['a', 'b']);
  });

  it('sends an empty list when nothing is ticked', () => {
    expect(checksToSend(new Set(), 3)).toEqual([]);
  });
});

describe('saveChecks', () => {
  it('patches the domain with a merge patch', async () => {
    const transport = jest.fn<typeof fetch>(async () =>
      Response.json({ id: 'd1' }),
    );
    await saveChecks('d1', ['csp'], transport);
    expect(transport).toHaveBeenCalledWith('/api/domains/d1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json' },
      body: JSON.stringify({ checks: ['csp'] }),
    });
  });

  it('sends null for every check', async () => {
    const transport = jest.fn<typeof fetch>(async () =>
      Response.json({ id: 'd1' }),
    );
    await saveChecks('d1', null, transport);
    expect(transport.mock.calls[0]?.[1]?.body).toBe('{"checks":null}');
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
    await expect(saveChecks('d1', [], transport)).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});

describe('CheckForm', () => {
  const out = htmlAt(
    <CheckForm domainId="d1" sections={SECTIONS} enabled={['csp']} />,
  );

  it('counts the checks that are on', () => {
    expect(out).toContain('1 of 3 checks on');
  });

  it('counts the checks on in each section', () => {
    expect(out).toContain('1 of 2</span>');
  });

  it('ticks the enabled checks', () => {
    expect(out).toMatch(/id="check-csp"[^>]* checked="" value="csp"/);
  });

  it('leaves the others unticked', () => {
    expect(out).toMatch(/id="check-etag"[^>]* name="checks" value="etag"/);
  });

  it('labels each check with its name and description', () => {
    expect(out).toMatch(
      /<label for="check-dnssec"><span[^>]*>DNSSEC<\/span><span[^>]*>Signed\.<\/span><\/label>/,
    );
  });

  it('ticks a section’s switch only when every check in it is on', () => {
    const all = htmlAt(
      <CheckForm domainId="d1" sections={SECTIONS} enabled={['dnssec']} />,
    );
    expect(
      all.match(/<input type="checkbox" class="focus-ring" checked=""/g),
    ).toHaveLength(1);
  });

  it('has a button that saves', () => {
    expect(out).toMatch(/<button type="submit"[^>]*>Save checks<\/button>/);
  });
});
