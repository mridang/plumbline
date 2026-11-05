import { describe, expect, it } from '@jest/globals';
import type { KeyboardEvent } from 'react';

import { TabList, TabPanel, moveFocus, tabId } from '@/components/ui-app/tabs';
import { html } from '../render';

const TABS = [
  { key: 'a.test', label: 'a.test', href: '/r?site=a.test' },
  { key: 'b.test', label: 'b.test', href: '/r?site=b.test' },
];

describe('TabList and TabPanel', () => {
  const out = html(
    <>
      <TabList label="Sites" panelId="site" tabs={TABS} current="b.test" />
      <TabPanel panelId="site" current="b.test">
        content
      </TabPanel>
    </>,
  );

  it('is a labelled tab list of links, one of them selected', () => {
    expect(out).toContain('role="tablist"');
    expect(out).toContain('aria-label="Sites"');
    expect(out).toMatch(/<a[^>]*role="tab"[^>]*href="\/r\?site=a\.test"/);
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-selected="true"[^>]*href="\/r\?site=b\.test"/);
  });

  it('puts only the selected tab in the tab order', () => {
    expect(out).toMatch(/aria-selected="false"[^>]*tabindex="-1"/);
    expect(out).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
  });

  it('ties the panel to the tab that opens it', () => {
    expect(out).toContain(`id="${tabId('site', 'b.test')}"`);
    expect(out).toContain('role="tabpanel"');
    expect(out).toContain(`aria-labelledby="${tabId('site', 'b.test')}"`);
    expect(out).toContain('aria-controls="site"');
  });

  it('marks the selected tab with a bar under it', () => {
    expect(out).toContain('border-ink');
  });
});

describe('moveFocus', () => {
  const press = (key: string, active: number) => {
    const focused: number[] = [];
    const tabs = [0, 1, 2].map((n) => {
      const element = {
        focus: () => focused.push(n),
      } as unknown as HTMLElement;
      return element;
    });
    Object.defineProperty(globalThis, 'document', {
      value: { activeElement: tabs[active] },
      configurable: true,
    });
    let prevented = false;
    moveFocus(
      {
        key,
        preventDefault: () => {
          prevented = true;
        },
      } as unknown as KeyboardEvent<HTMLElement>,
      tabs,
    );
    return { focused, prevented };
  };

  it('steps along with the arrows and wraps round the ends', () => {
    expect(press('ArrowRight', 0).focused).toEqual([1]);
    expect(press('ArrowRight', 2).focused).toEqual([0]);
    expect(press('ArrowLeft', 1).focused).toEqual([0]);
    expect(press('ArrowLeft', 0).focused).toEqual([2]);
  });

  it('goes to the ends with Home and End', () => {
    expect(press('Home', 2).focused).toEqual([0]);
    expect(press('End', 0).focused).toEqual([2]);
  });

  it('leaves every other key alone', () => {
    const result = press('a', 0);
    expect(result.focused).toEqual([]);
    expect(result.prevented).toBe(false);
  });
});
