import { describe, expect, it, jest } from '@jest/globals';

import {
  AddDomainForm,
  addDomain,
} from '@/app/(site)/domains/_components/add-domain-form';
import { ProblemError } from '@/components/api/problem-message';
import { htmlAt } from '../../../../components/render';

/** A server that answers every request with `response`. */
const answering = (response: () => Response) =>
  jest.fn<typeof fetch>(async () => response());

describe('addDomain', () => {
  it('posts the host as JSON', async () => {
    const transport = answering(() =>
      Response.json({ id: 'd1' }, { status: 201 }),
    );
    await addDomain('example.com', transport);
    expect(transport).toHaveBeenCalledWith('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'example.com' }),
    });
  });

  it('answers the id of the domain added', async () => {
    const transport = answering(() =>
      Response.json({ id: 'd1' }, { status: 201 }),
    );
    expect(await addDomain('example.com', transport)).toBe('d1');
  });

  it('answers the id of the domain the person already had', async () => {
    const transport = answering(() =>
      Response.json({ id: 'd0' }, { status: 200 }),
    );
    expect(await addDomain('example.com', transport)).toBe('d0');
  });

  it('rejects with the problem when the server refuses', async () => {
    const transport = answering(() =>
      Response.json(
        { title: 'Bad Request', status: 400, detail: 'Not a domain' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    await expect(addDomain('nope', transport)).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});

describe('AddDomainForm', () => {
  const out = htmlAt(<AddDomainForm />);

  it('has a labelled box for the domain', () => {
    expect(out).toContain('<label for="host" class="sr-only">Domain</label>');
  });

  it('requires a domain before it submits', () => {
    expect(out).toMatch(/<input[^>]*id="host"[^>]*required=""/);
  });

  it('has a button that adds it', () => {
    expect(out).toMatch(/<button type="submit"[^>]*>Add domain<\/button>/);
  });

  it('shows no problem before anything is tried', () => {
    expect(out).not.toContain('role="alert"');
  });
});
