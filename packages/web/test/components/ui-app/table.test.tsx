import { describe, expect, it } from '@jest/globals';

import {
  Cell,
  HeadCell,
  Row,
  Table,
  TableBody,
  TableHead,
} from '@/components/ui-app/table';
import { html } from '../render';

const draw = (current = false) =>
  html(
    <Table caption="Runs of site, newest first">
      <TableHead>
        <tr>
          <HeadCell>When</HeadCell>
          <HeadCell align="end" hidden>
            Report
          </HeadCell>
        </tr>
      </TableHead>
      <TableBody>
        <Row current={current}>
          <Cell>2 hours ago</Cell>
          <Cell align="end" nowrap={false}>
            x
          </Cell>
        </Row>
      </TableBody>
    </Table>,
  );

describe('Table', () => {
  it('scrolls inside its own box, so the page never widens', () => {
    expect(draw()).toContain('overflow-x-auto');
  });

  it('has a caption that is read out, not shown', () => {
    expect(draw()).toContain(
      '<caption class="sr-only">Runs of site, newest first</caption>',
    );
  });

  it('heads its columns with scoped headings, one of them read out only', () => {
    const out = draw();
    expect(out).toContain('scope="col"');
    expect(out).toContain('<span class="sr-only">Report</span>');
  });

  it('aligns a cell to the end and lets it wrap when asked', () => {
    const out = draw();
    expect(out).toContain('text-right');
    expect(out).toMatch(/<td class="px-4 py-2\.5 text-right">/);
  });

  it('tints the row the page is showing', () => {
    expect(draw(true)).toContain('bg-accent/6');
    expect(draw(false)).not.toContain('bg-accent/6');
  });
});
