import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../src/core/define-hint.js';
import { onPage } from '../../src/core/page.js';
import { documentationOf } from '../helpers/documentation.js';
import { runHint } from '../helpers/run-hint.js';

const make = (
  reference?: string,
  documentation?: { link: string; text: string }[],
) =>
  defineHint({
    id: 'sample',
    name: 'Sample hint',
    description: 'Reports once for the tests.',
    category: Category.development,
    groups: ['seo'],
    reference,
    setup(context) {
      onPage(context, (page) =>
        page.report('Something is wrong.', {
          severity: Severity.warning,
          ...(documentation ? { documentation } : {}),
        }),
      );
    },
  });

describe('defineHint', () => {
  it('exposes the reference and groups on the metadata', () => {
    const hint = make('https://example.com/rule');
    expect(documentationOf(hint.ctor)).toMatchObject({
      url: 'https://example.com/rule',
      groups: ['seo'],
    });
  });

  it('adds the reference as further reading to every finding', async () => {
    const [problem] = await runHint(make('https://example.com/rule'));
    expect(problem.documentation).toEqual([
      { link: 'https://example.com/rule', text: 'Sample hint' },
    ]);
  });

  it('keeps links a finding already has and adds the reference once', async () => {
    const own = { link: 'https://example.com/own', text: 'Own' };
    const [problem] = await runHint(
      make('https://example.com/rule', [
        own,
        { link: 'https://example.com/rule', text: 'Same' },
      ]),
    );
    expect(problem.documentation?.map((d) => d.link)).toEqual([
      'https://example.com/own',
      'https://example.com/rule',
    ]);
  });

  it('adds nothing when the hint has no reference', async () => {
    const [problem] = await runHint(make());
    expect(problem.documentation).toBeUndefined();
  });
});
