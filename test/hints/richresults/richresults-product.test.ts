import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-product.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-product', () => {
  it('does nothing when no Product node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors on a Product with an Offer missing price and priceCurrency', async () => {
    const problems = await runHint(
      hint,
      page({
        '@type': 'Product',
        name: 'P',
        image: 'i.jpg',
        offers: { '@type': 'Offer' },
      }),
    );
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      2,
    );
  });

  it('passes a Product with a valid offer', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'Product',
          name: 'P',
          image: 'i.jpg',
          offers: { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
        }),
      ),
    ).toEqual([]);
  });
});
