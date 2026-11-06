import { describe, expect, it } from '@jest/globals';

import TagsPage from '@/app/(site)/checks/tags/page';
import TagPage, {
  generateStaticParams,
} from '@/app/(site)/checks/tags/[tag]/page';
import { CONTROL_INFO } from '@/domain/checks/catalogue';
import { htmlAt } from '../../../../components/render';

describe('the tags page', () => {
  const out = htmlAt(<TagsPage />, { pathname: '/checks/tags' });

  it('links every tag a rule carries and says who fixes what', () => {
    for (const { tag } of generateStaticParams()) {
      expect(out).toContain(`href="/checks/tags/${tag}"`);
    }
    for (const control of CONTROL_INFO) {
      expect(out).toContain(control.description);
    }
  });
});

describe('a tag page', () => {
  const pageHtml = async (tag: string, search = {}): Promise<string> =>
    htmlAt(
      await TagPage({
        params: Promise.resolve({ tag }),
        searchParams: Promise.resolve(search),
      }),
      { pathname: `/checks/tags/${tag}` },
    );

  it('lists the rules of the tag across areas and how to select them', async () => {
    const out = await pageHtml('seo');
    expect(out).toContain('tag:seo');
    expect(out).toContain('seo-title-missing');
  });

  it('refuses a tag no rule carries', async () => {
    await expect(pageHtml('nope')).rejects.toThrow();
  });
});
