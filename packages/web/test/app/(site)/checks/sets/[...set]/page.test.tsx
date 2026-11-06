import { describe, expect, it } from '@jest/globals';

import SetPage, {
  generateMetadata,
  generateStaticParams,
} from '@/app/(site)/checks/sets/[...set]/page';
import { RULE_SET_DEFS, findRuleSet } from '@/domain/checks/sets';
import { htmlAt } from '../../../../../components/render';

const pageHtml = async (
  set: string[],
  search: Record<string, string> = {},
): Promise<string> =>
  htmlAt(
    await SetPage({
      params: Promise.resolve({ set }),
      searchParams: Promise.resolve(search),
    }),
    { pathname: `/checks/sets/${set.join('/')}` },
  );

describe('a rule set page', () => {
  it('has a page for every rule set', () => {
    expect(generateStaticParams()).toHaveLength(RULE_SET_DEFS.length);
    expect(generateStaticParams()).toContainEqual({ set: ['recommended'] });
    expect(generateStaticParams()).toContainEqual({ set: ['seo', 'advanced'] });
  });

  it('shows the size, the tiers, how to use it and the areas of the default set', async () => {
    const out = await pageHtml(['recommended']);
    const set = findRuleSet('plumbline:recommended')!;
    expect(out).toContain('Default');
    expect(out).toContain('what you get with no file');
    expect(out).toContain('Every rule in this set');
    expect(out).toContain('By area');
    expect(out).toContain(`${set.members.length}`);
    expect(out).toContain('Expand all');
    expect(out).toContain('Collapse all');
  });

  it('lists every rule of the set, in folds a long list starts closed', async () => {
    const out = await pageHtml(['recommended']);
    for (const id of findRuleSet('plumbline:recommended')!.members.slice(
      0,
      15,
    )) {
      expect(out).toContain(`>${id}</span>`);
    }
    expect(out).not.toMatch(/<details[^>]*open=""[^>]*class="group\/s/);
  });

  it('opens every area for ?open=all and a filtered list', async () => {
    expect(await pageHtml(['recommended'], { open: 'all' })).toMatch(
      /<details[^>]*open=""[^>]*group\/s/,
    );
    const filtered = await pageHtml(['recommended'], { q: 'strict-transport' });
    expect(filtered).toContain('>hsts</span>');
    expect(filtered).toMatch(/<details[^>]*open=""[^>]*group\/s/);
  });

  it('opens the row of one rule with what it checks and how to fix it', async () => {
    const out = await pageHtml(['recommended'], { rule: 'hsts' });
    expect(out).toContain('What it checks');
    expect(out).toContain('How to fix it');
    expect(out).toContain('Adapted from');
    expect(out).toContain('Selectors');
    expect(out).toContain('section:https');
  });

  it('says so when the filter matches nothing', async () => {
    expect(await pageHtml(['recommended'], { q: 'zzzz-nothing' })).toContain(
      'No rule matches.',
    );
  });

  it('hides the tier column and switch for a set of one tier', async () => {
    const out = await pageHtml(['experimental']);
    expect(out).not.toContain('aria-label="Tier"');
    expect(out).not.toContain('>Tier<');
    const many = await pageHtml(['all']);
    expect(many).toContain('aria-label="Tier"');
    expect(many).toContain('>Tier<');
  });

  it('shows an add-on as an opt-in area set', async () => {
    const out = await pageHtml(['email', 'recommended']);
    expect(out).toContain('plumbline:email/recommended');
    expect(out).toContain('- plumbline:email/recommended');
  });

  it('names the page for the set, and has nothing for a name that is not one', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ set: ['seo', 'advanced'] }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.alternates?.canonical).toBe('/checks/sets/seo/advanced');
    expect(
      await generateMetadata({
        params: Promise.resolve({ set: ['nope'] }),
        searchParams: Promise.resolve({}),
      }),
    ).toEqual({});
    await expect(pageHtml(['nope'])).rejects.toThrow();
  });
});
