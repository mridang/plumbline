import { describe, expect, it } from '@jest/globals';

import AreaPage, {
  generateMetadata,
  generateStaticParams,
} from '@/app/(site)/checks/areas/[section]/page';
import { CHECKS, SECTIONS } from '@/domain/checks/catalogue';
import { htmlAt } from '../../../../../components/render';

const pageHtml = async (
  section: string,
  search: Record<string, string> = {},
): Promise<string> =>
  htmlAt(
    await AreaPage({
      params: Promise.resolve({ section }),
      searchParams: Promise.resolve(search),
    }),
    { pathname: `/checks/areas/${section}` },
  );

describe('an area page', () => {
  it('has a page for every area', () => {
    expect(generateStaticParams()).toEqual(
      SECTIONS.map((s) => ({ section: s.id })),
    );
  });

  it('introduces the area, its sets and its rules by subsection', async () => {
    const out = await pageHtml('https');
    const section = SECTIONS.find((s) => s.id === 'https')!;
    expect(out).toContain(section.title);
    expect(out).toContain(section.intro);
    expect(out).toContain('Rule sets');
    expect(out).toContain('href="/checks/sets/https/recommended"');
    for (const check of CHECKS.filter((c) => c.section === 'https')) {
      expect(out).toContain(`>${check.id}</span>`);
    }
  });

  it('marks an opt-in area', async () => {
    expect(await pageHtml('email')).toContain('opt in');
    expect(await pageHtml('https')).not.toContain('opt in');
  });

  it('filters by tier', async () => {
    const out = await pageHtml('hardening', { tier: 'experimental' });
    const hardening = CHECKS.filter((c) => c.section === 'hardening');
    const gone = hardening.find((c) => c.tier !== 'experimental')!;
    expect(out).not.toContain(`>${gone.id}</span>`);
  });

  it('names the page and refuses an area that does not exist', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ section: 'seo' }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.alternates?.canonical).toBe('/checks/areas/seo');
    expect(
      await generateMetadata({
        params: Promise.resolve({ section: 'nope' }),
        searchParams: Promise.resolve({}),
      }),
    ).toEqual({});
    await expect(pageHtml('nope')).rejects.toThrow();
  });
});
