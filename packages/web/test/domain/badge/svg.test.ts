import { describe, expect, it } from '@jest/globals';

import { badgeSvg } from '@/domain/badge/svg';

describe('badgeSvg', () => {
  it('is an SVG that names both parts for assistive technology', () => {
    const svg = badgeSvg('plumbline', '98%', '#2da44e');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('aria-label="plumbline: 98%"');
    expect(svg).toContain('fill="#2da44e"');
  });

  it('is wider for longer text', () => {
    const width = (svg: string) => Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(width(badgeSvg('plumbline', 'not checked', '#999'))).toBeGreaterThan(
      width(badgeSvg('plumbline', '9%', '#999')),
    );
  });

  it('cannot be made to carry markup', () => {
    const svg = badgeSvg('<script>', '"x" & \'y\'', '"/><script>');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});
